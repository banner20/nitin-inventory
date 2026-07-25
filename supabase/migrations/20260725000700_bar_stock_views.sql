-- ============================================================================
-- Teach the derived views about consumption.
--
-- consumed / wasted / lost all mean "it isn't coming back", so all three
-- reduce what the company owns and close the person's outstanding balance.
-- They are kept apart because the difference is the entire point:
--
--   consumed -> expected, this is the business running normally
--   wasted   -> a cost worth watching
--   lost     -> unaccounted stock, and when the stock is liquor that is the
--               number Nitin actually wants to see
--
-- Separate migration from the one that created these enum values: Postgres
-- won't let a new enum value be used in the transaction that added it.
-- ============================================================================

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
    -- Anything that doesn't come back stops being ours.
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
  i.kind
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

-- "You usually also take…" — rebuilt unchanged, it was dropped only because it
-- reads txn_lines.
create or replace view v_item_cooccurrence
with (security_invoker = on) as
with event_items as (
  select distinct t.event_id, l.item_id
  from txns t
  join txn_lines l on l.txn_id = t.id
  where t.status = 'posted' and t.type = 'OUT' and t.event_id is not null
)
select
  a.item_id,
  b.item_id                as other_item_id,
  count(*)::integer        as events_together
from event_items a
join event_items b on a.event_id = b.event_id and a.item_id <> b.item_id
group by a.item_id, b.item_id;

-- Per event / person / item, now splitting the reasons apart.
create or replace view v_event_balances
with (security_invoker = on) as
select
  t.event_id,
  t.person_id,
  l.item_id,
  coalesce(sum(case when t.type = 'OUT' then l.qty else 0 end), 0)::numeric(12,3) as qty_out,
  coalesce(sum(case when t.type = 'IN' then l.qty else 0 end), 0)::numeric(12,3)  as qty_back,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'ok' then l.qty else 0 end), 0)::numeric(12,3)       as qty_returned,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'consumed' then l.qty else 0 end), 0)::numeric(12,3) as qty_consumed,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'wasted' then l.qty else 0 end), 0)::numeric(12,3)   as qty_wasted,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'damaged' then l.qty else 0 end), 0)::numeric(12,3)  as qty_damaged,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'lost' then l.qty else 0 end), 0)::numeric(12,3)     as qty_lost,
  coalesce(sum(case when t.type = 'OUT' then l.qty else -l.qty end), 0)::numeric(12,3) as outstanding
from txns t
join txn_lines l on l.txn_id = t.id
where t.status = 'posted' and t.type in ('OUT', 'IN')
group by t.event_id, t.person_id, l.item_id;

create view v_open_balances
with (security_invoker = on) as
select
  b.*,
  i.name    as item_name,
  i.unit,
  i.kind,
  e.name    as event_name,
  e.ends_at,
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

-- What an event actually cost in stock. For a bar company this is the number
-- that matters after every job: what went out, what came back, what was drunk,
-- and what quietly disappeared.
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
  sum(b.qty_consumed)::numeric(12,3) as qty_consumed,
  sum(b.qty_wasted)::numeric(12,3)   as qty_wasted,
  sum(b.qty_lost)::numeric(12,3)     as qty_lost,
  sum(b.outstanding)::numeric(12,3)  as still_out
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
group by b.event_id, e.name, b.item_id, i.name, i.unit, i.kind;
