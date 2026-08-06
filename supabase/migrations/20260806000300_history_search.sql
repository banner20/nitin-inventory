-- ============================================================================
-- Make history searchable on the server, not just on the page you're looking at.
--
-- The search box filtered the thirty rows already loaded. Anything older
-- returned "Nothing matches that search" — a confident, wrong answer, and the
-- worst kind: it looks like proof something never happened. Worse, the "Load
-- more" button hid itself while a search was active, so there was no way to
-- reach the rest.
--
-- Searching needs the item names, which live in a jsonb array on the view, so
-- there's nothing PostgREST can filter on directly. A flattened text column
-- gives it something — every name, person, event and note for a transaction,
-- lowercased into one string that ILIKE can scan.
-- ============================================================================

drop view if exists v_txn_history;

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
  ) as lines,
  -- Everything a person might type into the search box, in one scannable
  -- string: who did it, who for, which job, the note, and every item on it.
  lower(concat_ws(' ',
    e.name,
    actor.full_name, actor.emp_code,
    person.full_name, person.emp_code,
    t.note,
    (select string_agg(distinct i.name, ' ')
     from txn_lines l join items i on i.id = l.item_id
     where l.txn_id = t.id),
    (select string_agg(distinct l.vendor, ' ')
     from txn_lines l where l.txn_id = t.id and l.vendor is not null)
  )) as search_text
from txns t
left join events e on e.id = t.event_id
left join profiles actor on actor.id = t.created_by
left join profiles person on person.id = t.person_id
order by t.occurred_at desc;
