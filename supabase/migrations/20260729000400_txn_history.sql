-- ============================================================================
-- Transaction history: every stock action, with who did it.
--
-- One row per transaction (not per line), with its lines folded into a JSON
-- array — a manager reading history wants "who took what out for which
-- event", not one row per item that makes a single check-out look like ten
-- unrelated events.
--
-- security_invoker means this inherits the RLS already on txns/txn_lines: a
-- manager sees everything, crew see only their own. No separate access rule
-- to keep in sync with the one that already exists.
-- ============================================================================

create or replace view v_txn_history
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
