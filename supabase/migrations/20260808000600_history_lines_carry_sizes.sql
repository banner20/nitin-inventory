-- ============================================================================
-- Give each history line the item's other sizes.
--
-- Correcting an entry should offer the same choices as recording it did. Take
-- Out lets you say two 700ml bottles, or a 500ml one, or 250ml loose, because
-- that's how the stock actually comes off the shelf. The edit on History could
-- only offer one fixed size, so anything that wasn't a whole number of the
-- item's default pack had to be typed as a fraction — "2.357 bottles" for two
-- bottles and 250ml, which nobody should ever have to work out.
--
-- The sizes were simply missing from the view. Everything else here is
-- unchanged.
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
  t.created_by,
  t.voided_at,
  t.void_reason,
  t.replaces_txn_id,
  (select true from txns r where r.replaces_txn_id = t.id limit 1) as was_corrected,
  voider.full_name as voided_by_name,
  e.name          as event_name,
  actor.full_name as actor_name,
  actor.emp_code  as actor_emp_code,
  person.full_name as person_name,
  person.emp_code as person_emp_code,
  (
    select jsonb_agg(
      jsonb_build_object(
        'item_id', i.id,
        'item_name', i.name,
        'unit', i.unit,
        'qty', l.qty,
        'condition', l.condition,
        'from_quarantine', l.from_quarantine,
        'from_loose', l.from_loose,
        'unit_cost', l.unit_cost,
        'vendor', l.vendor,
        'pack_size', i.pack_size,
        'pack_label', i.pack_label,
        -- The same shape the take-out screen reads, so the amount control can
        -- offer every size this item is genuinely stocked in.
        'alt_packs', (
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id, 'pack_size', p.pack_size,
              'pack_label', p.pack_label, 'sku', p.sku, 'unit_cost', p.unit_cost
            ) order by p.sort, p.pack_size)
          from item_packs p where p.item_id = i.id
        )
      )
      order by i.name
    )
    from txn_lines l
    join items i on i.id = l.item_id
    where l.txn_id = t.id
  ) as lines,
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
left join profiles voider on voider.id = t.voided_by
order by t.occurred_at desc;
