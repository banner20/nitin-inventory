-- ============================================================================
-- Multiple concurrent pack sizes, expiry dates, and purchase history surfaced
-- onto the item.
--
-- Prompted by the real 30 Sixty inventory spreadsheet: they buy the same
-- syrup in more than one bottle size at once (Hazelnut as both 250ml bottles
-- and a 1L jug), and nearly every line carries an expiry date they actually
-- use.
--
-- item_packs holds only the EXTRA pack options — an item's primary pack
-- stays on items.pack_size/pack_label exactly as before, so the ~150 items
-- that only ever come in one size need no data migration and no UI change.
-- ============================================================================

create table item_packs (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items (id) on delete cascade,
  pack_size  numeric(12, 3) not null check (pack_size > 0),
  pack_label text not null,
  sku        text,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index item_packs_item_label_unique on item_packs (item_id, lower(pack_label));
create index item_packs_item_idx on item_packs (item_id);

alter table item_packs enable row level security;

create policy item_packs_select on item_packs for select to authenticated using (true);
create policy item_packs_manage on item_packs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- Expiry. One nullable date per item — not per delivery. Real lot/batch
-- tracking (different expiry per purchase) is a materially bigger feature
-- nobody has asked for; this answers "is this thing going off soon" without
-- pretending to track which physical bottle expires when.
-- ---------------------------------------------------------------------------
alter table items add column expiry_date date;

-- ---------------------------------------------------------------------------
-- Rebuild the stock views: alt pack options, expiry, and last purchase info.
-- Last vendor/cost answer "add vendors and costs" without a static field that
-- can silently go stale — it's read straight from the ADD history that
-- Stock In already records, the same way every other derived figure here is.
-- ---------------------------------------------------------------------------
drop view if exists v_person_liability;
drop view if exists v_open_balances;
drop view if exists v_recipe_requirements;
drop view if exists v_item_availability;

create or replace view v_item_stock
with (security_invoker = on) as
select
  i.id                                       as item_id,
  i.name,
  i.category_id,
  i.unit,
  i.min_stock,
  i.active,
  coalesce(sum(case
    when t.type = 'ADD' then l.qty
    when t.type = 'WRITEOFF' then -l.qty
    when t.type = 'IN' and l.condition in ('lost', 'consumed', 'wasted') then -l.qty
  end), 0)::numeric(12,3)                    as qty_owned,
  coalesce(sum(case
    when t.type = 'OUT' then l.qty
    when t.type = 'IN' then -l.qty
  end), 0)::numeric(12,3)                    as qty_out,
  coalesce(sum(case
    when t.type = 'IN' and l.condition = 'damaged' then l.qty
    when t.type = 'REPAIR' then -l.qty
    when t.type = 'WRITEOFF' and l.from_quarantine then -l.qty
  end), 0)::numeric(12,3)                    as qty_quarantined,
  i.aliases,
  i.sku,
  c.name                                     as category_name,
  i.kind,
  i.pack_size,
  i.pack_label,
  i.expiry_date,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'pack_size', p.pack_size, 'pack_label', p.pack_label, 'sku', p.sku
      )
      order by p.sort, p.pack_size
    )
    from item_packs p
    where p.item_id = i.id
  ) as alt_packs,
  (
    select l.vendor
    from txn_lines l
    join txns t2 on t2.id = l.txn_id
    where l.item_id = i.id and t2.type = 'ADD' and l.vendor is not null
    order by t2.occurred_at desc
    limit 1
  ) as last_vendor,
  (
    select l.unit_cost
    from txn_lines l
    join txns t2 on t2.id = l.txn_id
    where l.item_id = i.id and t2.type = 'ADD' and l.unit_cost is not null
    order by t2.occurred_at desc
    limit 1
  ) as last_unit_cost,
  (
    select t2.occurred_at
    from txn_lines l
    join txns t2 on t2.id = l.txn_id
    where l.item_id = i.id and t2.type = 'ADD'
    order by t2.occurred_at desc
    limit 1
  ) as last_purchased_at
from items i
left join categories c on c.id = i.category_id
left join txn_lines l on l.item_id = i.id
left join txns t on t.id = l.txn_id and t.status = 'posted'
group by i.id, c.name;

create view v_item_availability
with (security_invoker = on) as
select
  s.*,
  (s.qty_owned - s.qty_out - s.qty_quarantined)::numeric(12,3) as qty_available,
  (s.qty_owned - s.qty_out - s.qty_quarantined) < s.min_stock  as below_min
from v_item_stock s;

create view v_open_balances
with (security_invoker = on) as
select
  b.*,
  i.name       as item_name,
  i.unit,
  i.kind,
  i.pack_size,
  i.pack_label,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'pack_size', p.pack_size, 'pack_label', p.pack_label, 'sku', p.sku
      )
      order by p.sort, p.pack_size
    )
    from item_packs p
    where p.item_id = i.id
  ) as alt_packs,
  e.name       as event_name,
  e.ends_at,
  e.created_at as event_created_at,
  (now() > e.ends_at) as overdue
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
where b.outstanding > 0;

create view v_person_liability
with (security_invoker = on) as
select
  person_id,
  count(distinct event_id)::integer as open_events,
  sum(outstanding)::numeric(12,3)   as items_outstanding,
  count(*) filter (where overdue)::integer as overdue_lines
from v_open_balances
group by person_id;

-- v_recipe_requirements only reads qty_available, which v_item_availability
-- still exposes unchanged — recreated verbatim.
create view v_recipe_requirements
with (security_invoker = on) as
select
  r.id            as recipe_id,
  r.name          as recipe_name,
  rl.item_id,
  i.name          as item_name,
  i.unit,
  i.pack_size,
  i.pack_label,
  rl.qty          as qty_per_serve,
  a.qty_available,
  case
    when rl.qty > 0 then floor(a.qty_available / rl.qty)
  end::integer    as serves_possible
from recipes r
join recipe_lines rl on rl.recipe_id = r.id
join items i on i.id = rl.item_id
join v_item_availability a on a.item_id = rl.item_id
where r.active;

-- ---------------------------------------------------------------------------
-- Two new categories the real inventory needs.
-- ---------------------------------------------------------------------------
insert into categories (name, sort) values
  ('Pantry & Condiments', 120),
  ('Acids & Mixology Chemicals', 130)
on conflict (name) do nothing;
