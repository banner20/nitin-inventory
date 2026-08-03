-- ============================================================================
-- Wire the new 'loose' condition and from_loose flag into the derived views,
-- and let post_txn actually accept from_loose (it already passed condition
-- through generically, so 'loose' needed no RPC change there — only the
-- from_loose flag and a real bug: qty was being cast to integer despite the
-- column being numeric(12,3), silently truncating anything fractional).
-- ============================================================================

drop view if exists v_person_liability;
drop view if exists v_recipe_requirements;
drop view if exists v_open_balances;
drop view if exists v_event_consumption;
drop view if exists v_item_availability;
drop view if exists v_item_stock;
drop view if exists v_event_balances;

create view v_event_balances
with (security_invoker = on) as
select
  t.event_id,
  t.person_id,
  l.item_id,
  coalesce(sum(case when t.type = 'OUT' then l.qty else 0 end), 0)::numeric(12,3) as qty_out,
  coalesce(sum(case when t.type = 'IN' then l.qty else 0 end), 0)::numeric(12,3)  as qty_back,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'ok' then l.qty else 0 end), 0)::numeric(12,3)       as qty_returned,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'loose' then l.qty else 0 end), 0)::numeric(12,3)    as qty_returned_loose,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'consumed' then l.qty else 0 end), 0)::numeric(12,3) as qty_consumed,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'wasted' then l.qty else 0 end), 0)::numeric(12,3)   as qty_wasted,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'damaged' then l.qty else 0 end), 0)::numeric(12,3)  as qty_damaged,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'lost' then l.qty else 0 end), 0)::numeric(12,3)     as qty_lost,
  coalesce(sum(case when t.type = 'OUT' then l.qty else -l.qty end), 0)::numeric(12,3) as outstanding
from txns t
join txn_lines l on l.txn_id = t.id
where t.status = 'posted' and t.type in ('OUT', 'IN')
group by t.event_id, t.person_id, l.item_id;

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
  (select jsonb_agg(jsonb_build_object('id',p.id,'pack_size',p.pack_size,'pack_label',p.pack_label,'sku',p.sku) order by p.sort, p.pack_size)
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
select s.*, (s.qty_owned - s.qty_out - s.qty_quarantined)::numeric(12,3) as qty_available,
  (s.qty_owned - s.qty_out - s.qty_quarantined) < s.min_stock as below_min
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

create view v_open_balances with (security_invoker = on) as
select b.*, i.name as item_name, i.unit, i.kind, i.pack_size, i.pack_label,
  (select jsonb_agg(jsonb_build_object('id',p.id,'pack_size',p.pack_size,'pack_label',p.pack_label,'sku',p.sku) order by p.sort, p.pack_size)
   from item_packs p where p.item_id = i.id) as alt_packs,
  e.name as event_name, e.ends_at, e.created_at as event_created_at, (now() > e.ends_at) as overdue,
  pr.full_name as person_name
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
join profiles pr on pr.id = b.person_id
where b.outstanding > 0;

create view v_person_liability with (security_invoker = on) as
select person_id, count(distinct event_id)::integer as open_events,
  sum(outstanding)::numeric(12,3) as items_outstanding,
  count(*) filter (where overdue)::integer as overdue_lines
from v_open_balances group by person_id;

create or replace view v_event_consumption
with (security_invoker = on) as
select
  b.event_id,
  e.name as event_name,
  b.item_id,
  i.name as item_name,
  i.unit,
  i.kind,
  sum(b.qty_out)::numeric(12,3)      as qty_out,
  sum(b.qty_returned)::numeric(12,3) as qty_returned,
  sum(b.qty_returned_loose)::numeric(12,3) as qty_returned_loose,
  sum(b.qty_consumed)::numeric(12,3) as qty_consumed,
  sum(b.qty_wasted)::numeric(12,3)   as qty_wasted,
  sum(b.qty_lost)::numeric(12,3)     as qty_lost,
  sum(b.outstanding)::numeric(12,3)  as still_out
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
group by b.event_id, e.name, b.item_id, i.name, i.unit, i.kind;

-- post_txn: accept from_loose (mirrors from_quarantine), and stop truncating
-- fractional quantities — qty has been numeric(12,3) since bar stock was
-- introduced, but this cast was never updated to match.
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
      nullif(line ->> 'unit_cost', '')::numeric,
      nullif(trim(coalesce(line ->> 'vendor', '')), ''),
      nullif(trim(coalesce(line ->> 'note', '')), '')
    );
  end loop;

  return tid;
end;
$$;
