-- ============================================================================
-- Pack details on open balances.
--
-- The return screen shows "6 bottles went out" and asks how much is coming
-- back, so it needs the same pack information the master sheet has. Without
-- it the crew would be reconciling in millilitres, which is exactly what pack
-- sizes exist to avoid.
-- ============================================================================

drop view if exists v_person_liability;
drop view if exists v_open_balances;

create view v_open_balances
with (security_invoker = on) as
select
  b.*,
  i.name       as item_name,
  i.unit,
  i.kind,
  i.pack_size,
  i.pack_label,
  e.name       as event_name,
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
