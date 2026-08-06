-- ============================================================================
-- Two things, both about telling sizes apart.
--
-- 1. A delivery can contain the same syrup in two sizes — three 250ml bottles
--    and two 500ml ones, at different prices. That was impossible to record:
--    txn_lines_unique_item stops one transaction holding two lines for the
--    same item, so the second size collided with the first. The fix is to make
--    the pack part of what identifies a line, which the ledger should have
--    been doing anyway — until now the size a thing was bought in was thrown
--    away the moment it was converted to base units, so "we bought the 1L jug"
--    and "we bought four 250ml bottles" left identical records.
--
-- 2. Accounts need a per-event bill: what went out, what came back, what was
--    actually used, and what that cost. All the quantities existed already;
--    none of them had money attached.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Which size a line was bought in.
-- ---------------------------------------------------------------------------

alter table txn_lines
  add column pack_id uuid references item_packs (id) on delete set null;

comment on column txn_lines.pack_id is
  'Which pack size this line was counted in — an item_packs id, or null for the item''s default pack. The qty is still in base units; this only records how it was bought, so a delivery can hold two sizes of the same item and each size''s price can be tracked separately.';

-- Same item, same condition, different size is now a legitimately distinct
-- line. Everything else about the constraint is unchanged.
drop index txn_lines_unique_item;
create unique index txn_lines_unique_item
  on txn_lines (txn_id, item_id, condition, from_quarantine, from_loose, pack_id)
  nulls not distinct;

create or replace function public.post_txn(
  p_client_uuid uuid,
  p_type        txn_type,
  p_lines       jsonb,
  p_event_id    uuid default null,
  p_person_id   uuid default null,
  p_note        text default null,
  p_source      txn_source default 'manual',
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  existing uuid;
  tid      uuid;
  line     jsonb;
  v_pack   uuid;
begin
  if p_client_uuid is null then
    raise exception 'client_uuid is required (it is what makes a retry safe)';
  end if;

  select id into existing from public.txns where client_uuid = p_client_uuid;
  if existing is not null then
    return existing;
  end if;

  if coalesce(jsonb_array_length(p_lines), 0) = 0 then
    raise exception 'A transaction needs at least one line';
  end if;

  insert into public.txns (
    client_uuid, type, event_id, person_id, created_by,
    status, source, note, occurred_at
  ) values (
    p_client_uuid, p_type, p_event_id, p_person_id, auth.uid(),
    'posted', coalesce(p_source, 'manual'), nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_occurred_at, now())
  )
  returning id into tid;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    -- 'default' and absent both mean the item's own pack, stored as null.
    v_pack := case
      when nullif(line ->> 'pack_id', '') is null then null
      when (line ->> 'pack_id') = 'default' then null
      else (line ->> 'pack_id')::uuid
    end;

    insert into public.txn_lines (
      txn_id, item_id, qty, condition, from_quarantine, from_loose,
      unit_cost, vendor, note, pack_id
    ) values (
      tid,
      (line ->> 'item_id')::uuid,
      (line ->> 'qty')::numeric(12,3),
      nullif(line ->> 'condition', '')::line_condition,
      coalesce((line ->> 'from_quarantine')::boolean, false),
      coalesce((line ->> 'from_loose')::boolean, false),
      nullif(line ->> 'unit_cost', '')::numeric(14,6),
      nullif(trim(coalesce(line ->> 'vendor', '')), ''),
      nullif(trim(coalesce(line ->> 'note', '')), ''),
      v_pack
    );

    -- Buying something at a new price is the moment its price changed, and
    -- each size holds its own — a cheap bulk jug must not overwrite what a
    -- single bottle costs.
    if p_type = 'ADD' and nullif(line ->> 'unit_cost', '') is not null then
      if v_pack is not null then
        update public.item_packs
        set unit_cost = (line ->> 'unit_cost')::numeric(14,6)
        where id = v_pack and item_id = (line ->> 'item_id')::uuid;
      else
        update public.items
        set unit_cost = (line ->> 'unit_cost')::numeric(14,6)
        where id = (line ->> 'item_id')::uuid;
      end if;
    end if;
  end loop;

  return tid;
end;
$$;

revoke all on function public.post_txn(uuid, txn_type, jsonb, uuid, uuid, text, txn_source, timestamptz) from public, anon;
grant execute on function public.post_txn(uuid, txn_type, jsonb, uuid, uuid, text, txn_source, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. What an event cost.
-- ---------------------------------------------------------------------------

-- Damaged was missing from the consumption view — it's stock that came back
-- unusable, which accounts care about as much as stock that never came back.
drop view if exists v_event_consumption;

create view v_event_consumption
with (security_invoker = on) as
select
  b.event_id,
  e.name as event_name,
  b.item_id,
  i.name as item_name,
  i.unit,
  i.kind,
  sum(b.qty_out)::numeric(12,3)            as qty_out,
  sum(b.qty_returned)::numeric(12,3)       as qty_returned,
  sum(b.qty_returned_loose)::numeric(12,3) as qty_returned_loose,
  sum(b.qty_consumed)::numeric(12,3)       as qty_consumed,
  sum(b.qty_wasted)::numeric(12,3)         as qty_wasted,
  sum(b.qty_damaged)::numeric(12,3)        as qty_damaged,
  sum(b.qty_lost)::numeric(12,3)           as qty_lost,
  sum(b.outstanding)::numeric(12,3)        as still_out
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
group by b.event_id, e.name, b.item_id, i.name, i.unit, i.kind;

-- The per-event bill. "Used up" is everything the company no longer has:
-- served, spilled, or never came back. Damaged is listed but not billed —
-- it's still physically owned, just not usable yet, so counting it as spend
-- would double-charge when it's later repaired or written off.
create view v_event_costs
with (security_invoker = on) as
select
  c.event_id,
  c.event_name,
  c.item_id,
  c.item_name,
  c.unit,
  c.kind,
  cat.name as category_name,
  i.pack_size,
  i.pack_label,
  i.unit_cost,
  c.qty_out,
  c.qty_returned,
  c.qty_consumed,
  c.qty_wasted,
  c.qty_damaged,
  c.qty_lost,
  c.still_out,
  (c.qty_consumed + c.qty_wasted + c.qty_lost)::numeric(12,3) as qty_used,
  case when i.unit_cost is not null
    then round((c.qty_consumed + c.qty_wasted + c.qty_lost) * i.unit_cost, 2)
  end as cost_used,
  case when i.unit_cost is not null
    then round(c.qty_out * i.unit_cost, 2)
  end as cost_taken_out
from v_event_consumption c
join items i on i.id = c.item_id
left join categories cat on cat.id = i.category_id;
