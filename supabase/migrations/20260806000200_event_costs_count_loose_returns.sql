-- ============================================================================
-- Stock that comes back as an opened bottle is still stock that came back.
--
-- v_event_costs reported qty_returned, which is only the sealed returns
-- (condition 'ok'). Anything handed back part-used comes in as 'loose' and was
-- counted nowhere: not as returned, not as used, not as still out. On a real
-- event that meant 800ml going out, 544ml served, 256ml handed back in an open
-- bottle, and a bill that silently accounted for only 544 of the 800 — the
-- remaining 256ml simply wasn't on it.
--
-- Adding it makes the arithmetic close: what went out equals what came back
-- (sealed plus loose) plus what was used up plus what's still out.
-- ============================================================================

drop view if exists v_event_costs;

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
  -- Handed back part-used. Physically on the shelf again, so it belongs with
  -- returns rather than with consumption.
  c.qty_returned_loose,
  (c.qty_returned + c.qty_returned_loose)::numeric(12,3) as qty_back_total,
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
  end as cost_taken_out,
  case when i.unit_cost is not null
    then round((c.qty_returned + c.qty_returned_loose) * i.unit_cost, 2)
  end as cost_back
from v_event_consumption c
join items i on i.id = c.item_id
left join categories cat on cat.id = i.category_id;
