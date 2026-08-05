-- ============================================================================
-- What the stock is worth.
--
-- Price already existed, but only as history: every ADD line could carry a
-- unit_cost, and the master sheet read the most recent one back. That gives a
-- price trail for free and never goes stale, which is right — but it can't
-- answer "what is this item worth today" for anything bought before the system
-- existed, and there was nowhere to correct a wrong figure by hand.
--
-- So: items gain a `unit_cost` — the price per base unit that valuation uses.
-- Stocking something in at a new price updates it automatically (the common
-- case, and the one nobody should have to remember to do), and it can also be
-- set directly when an item is created or edited (the opening-balance case,
-- and the correction case). Whichever happened most recently wins, which is
-- what anyone would expect. The per-purchase history stays on txn_lines
-- untouched, so "what did we pay in June vs August" is still answerable.
--
-- Precision: unit_cost was numeric(12,2), but it holds a price *per base
-- unit*, and base units are small. A ₹450 bottle of 700ml is ₹0.642857/ml,
-- which rounds to 0.64 and values the bottle back at ₹448 — ₹2 lost per
-- bottle, silently, on every valuation. Widened to 6 decimal places.
-- ============================================================================

-- Widening the column means dropping everything that reads it first; they are
-- all recreated below.
drop view if exists v_txn_history;
drop view if exists v_recipe_requirements;
drop view if exists v_item_availability;
drop view if exists v_item_stock;

alter table txn_lines
  alter column unit_cost type numeric(14, 6);

alter table items
  add column unit_cost numeric(14, 6) check (unit_cost is null or unit_cost >= 0);

comment on column items.unit_cost is
  'Current price of one base unit of the item''s DEFAULT pack, used for stock valuation. Updated automatically by an ADD line that states a cost, and editable by hand for opening balances or corrections. Alternative pack sizes carry their own price on item_packs.unit_cost. Per-purchase history lives on txn_lines.unit_cost.';

-- A bigger pack is normally cheaper per unit — that is the entire reason for
-- buying one. A 250ml bottle at ₹200 is ₹0.80/ml; a 1L jug at ₹700 is
-- ₹0.70/ml. One price per item cannot hold both, so each alternative size
-- carries its own.
alter table item_packs
  add column unit_cost numeric(14, 6) check (unit_cost is null or unit_cost >= 0);

comment on column item_packs.unit_cost is
  'Current price of one base unit when bought in THIS pack size. Bulk is usually cheaper per unit than the default pack, so prices are held per size rather than per item. Valuation uses the item''s default pack rate (items.unit_cost).';

-- Backfill from what each item was last actually bought for, so valuation
-- means something the moment this lands.
update items i
set unit_cost = latest.unit_cost
from (
  select distinct on (l.item_id)
    l.item_id, l.unit_cost
  from txn_lines l
  join txns t on t.id = l.txn_id
  where t.type = 'ADD' and t.status = 'posted' and l.unit_cost is not null
  order by l.item_id, t.occurred_at desc
) latest
where i.id = latest.item_id;

-- ---------------------------------------------------------------------------
-- Rebuild the derived views to carry price and value.
-- ---------------------------------------------------------------------------

create view v_item_stock
with (security_invoker = on) as
select
  i.id as item_id, i.name, i.category_id, i.unit, i.min_stock, i.active,
  coalesce(sum(case when t.type='ADD' then l.qty when t.type='WRITEOFF' then -l.qty
    when t.type='IN' and l.condition in ('lost','consumed','wasted') then -l.qty end),0)::numeric(12,3) as qty_owned,
  coalesce(sum(case when t.type='OUT' then l.qty when t.type='IN' then -l.qty end),0)::numeric(12,3) as qty_out,
  coalesce(sum(case when t.type='IN' and l.condition='damaged' then l.qty
    when t.type='REPAIR' then -l.qty when t.type='WRITEOFF' and l.from_quarantine then -l.qty end),0)::numeric(12,3) as qty_quarantined,
  -- Opened/partial stock, distinct from a fresh sealed pack: builds up from
  -- bottles brought back part-used, drains as Take Out draws from that pool
  -- specifically instead of a new sealed pack.
  coalesce(sum(case when t.type='IN' and l.condition='loose' then l.qty
    when t.type='OUT' and l.from_loose then -l.qty end),0)::numeric(12,3) as qty_loose,
  i.aliases, i.sku, c.name as category_name, i.kind, i.pack_size, i.pack_label, i.expiry_date,
  i.unit_cost,
  (select jsonb_agg(jsonb_build_object('id',p.id,'pack_size',p.pack_size,'pack_label',p.pack_label,'sku',p.sku,'unit_cost',p.unit_cost) order by p.sort, p.pack_size)
   from item_packs p where p.item_id = i.id) as alt_packs,
  (select l.vendor from txn_lines l join txns t2 on t2.id=l.txn_id
   where l.item_id=i.id and t2.type='ADD' and l.vendor is not null order by t2.occurred_at desc limit 1) as last_vendor,
  (select l.unit_cost from txn_lines l join txns t2 on t2.id=l.txn_id
   where l.item_id=i.id and t2.type='ADD' and l.unit_cost is not null order by t2.occurred_at desc limit 1) as last_unit_cost,
  (select t2.occurred_at from txn_lines l join txns t2 on t2.id=l.txn_id
   where l.item_id=i.id and t2.type='ADD' order by t2.occurred_at desc limit 1) as last_purchased_at
from items i
left join categories c on c.id = i.category_id
left join txn_lines l on l.item_id = i.id
left join txns t on t.id = l.txn_id and t.status = 'posted'
group by i.id, c.name;

create view v_item_availability with (security_invoker = on) as
select
  s.*,
  (s.qty_owned - s.qty_out - s.qty_quarantined)::numeric(12,3) as qty_available,
  (s.qty_owned - s.qty_out - s.qty_quarantined) < s.min_stock as below_min,
  -- What the stock still on the shelf is worth. Null rather than zero when
  -- there's no price on file, so "we don't know" and "it's worthless" stay
  -- distinguishable — the master sheet counts the unpriced ones separately.
  case when s.unit_cost is not null
    then round((s.qty_owned - s.qty_out - s.qty_quarantined) * s.unit_cost, 2)
  end as stock_value
from v_item_stock s;

create view v_recipe_requirements with (security_invoker = on) as
select r.id as recipe_id, r.name as recipe_name, rl.item_id, i.name as item_name, i.unit,
  i.pack_size, i.pack_label, rl.qty as qty_per_serve, a.qty_available,
  case when rl.qty > 0 then floor(a.qty_available / rl.qty) end::integer as serves_possible
from recipes r
join recipe_lines rl on rl.recipe_id = r.id
join items i on i.id = rl.item_id
join v_item_availability a on a.item_id = rl.item_id
where r.active;

-- Unchanged from 20260729000400 — recreated here only because widening
-- txn_lines.unit_cost required dropping everything that reads it.
create view v_txn_history
with (security_invoker = on) as
select
  t.id            as txn_id,
  t.type,
  t.status,
  t.source,
  t.note,
  t.occurred_at,
  t.created_at,
  e.name          as event_name,
  actor.full_name as actor_name,
  actor.emp_code  as actor_emp_code,
  person.full_name as person_name,
  person.emp_code as person_emp_code,
  (
    select jsonb_agg(
      jsonb_build_object(
        'item_name', i.name,
        'unit', i.unit,
        'qty', l.qty,
        'condition', l.condition,
        'from_quarantine', l.from_quarantine,
        'unit_cost', l.unit_cost,
        'vendor', l.vendor,
        'pack_size', i.pack_size,
        'pack_label', i.pack_label
      )
      order by i.name
    )
    from txn_lines l
    join items i on i.id = l.item_id
    where l.txn_id = t.id
  ) as lines
from txns t
left join events e on e.id = t.event_id
left join profiles actor on actor.id = t.created_by
left join profiles person on person.id = t.person_id
order by t.occurred_at desc;

-- ---------------------------------------------------------------------------
-- Keep items.unit_cost current from what actually gets bought.
-- ---------------------------------------------------------------------------

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
    insert into public.txn_lines (
      txn_id, item_id, qty, condition, from_quarantine, from_loose, unit_cost, vendor, note
    ) values (
      tid,
      (line ->> 'item_id')::uuid,
      (line ->> 'qty')::numeric(12,3),
      nullif(line ->> 'condition', '')::line_condition,
      coalesce((line ->> 'from_quarantine')::boolean, false),
      coalesce((line ->> 'from_loose')::boolean, false),
      nullif(line ->> 'unit_cost', '')::numeric(14,6),
      nullif(trim(coalesce(line ->> 'vendor', '')), ''),
      nullif(trim(coalesce(line ->> 'note', '')), '')
    );

    -- Buying something at a new price is the moment its price changed. Doing
    -- this here rather than asking the UI to remember means it can't be
    -- forgotten, and it can't disagree with the line that was just written.
    --
    -- pack_id says which size was bought, so buying a cheaper bulk jug
    -- updates the jug's price and leaves the bottle's alone. It is not
    -- stored on the line — the ledger stays in base units by design — it
    -- only says which price this purchase is evidence of.
    if p_type = 'ADD' and nullif(line ->> 'unit_cost', '') is not null then
      if nullif(line ->> 'pack_id', '') is not null
         and (line ->> 'pack_id') <> 'default' then
        update public.item_packs
        set unit_cost = (line ->> 'unit_cost')::numeric(14,6)
        where id = (line ->> 'pack_id')::uuid
          and item_id = (line ->> 'item_id')::uuid;
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
-- Price history: what an item has actually been bought for, over time.
-- ---------------------------------------------------------------------------

create view v_item_price_history
with (security_invoker = on) as
select
  l.item_id,
  t.occurred_at,
  l.unit_cost,
  l.qty,
  round(l.qty * l.unit_cost, 2) as line_total,
  l.vendor,
  p.full_name as bought_by
from txn_lines l
join txns t on t.id = l.txn_id
left join profiles p on p.id = t.created_by
where t.type = 'ADD' and t.status = 'posted' and l.unit_cost is not null;
