-- ============================================================================
-- Put aliases and the category name on the stock view.
--
-- The items table has had alias search since day one, but the availability
-- view didn't carry the aliases, so the screens filtering on that view could
-- only match the official name. In a system with no scanning, where typing is
-- the only input, "par can" failing to find "LED PAR 64" is not a cosmetic
-- gap — it is the feature not working.
-- ============================================================================

-- v_item_availability selects s.* and then computes columns, so appending to
-- the underlying view would shift positions. Drop and rebuild it.
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
    when t.type = 'IN' and l.condition = 'lost' then -l.qty
  end), 0)::integer                          as qty_owned,
  coalesce(sum(case
    when t.type = 'OUT' then l.qty
    when t.type = 'IN' then -l.qty
  end), 0)::integer                          as qty_out,
  coalesce(sum(case
    when t.type = 'IN' and l.condition = 'damaged' then l.qty
    when t.type = 'REPAIR' then -l.qty
    when t.type = 'WRITEOFF' and l.from_quarantine then -l.qty
  end), 0)::integer                          as qty_quarantined,
  i.aliases,
  i.sku,
  c.name                                     as category_name
from items i
left join categories c on c.id = i.category_id
left join txn_lines l on l.item_id = i.id
left join txns t on t.id = l.txn_id and t.status = 'posted'
group by i.id, c.name;

create view v_item_availability
with (security_invoker = on) as
select
  s.*,
  (s.qty_owned - s.qty_out - s.qty_quarantined)::integer as qty_available,
  (s.qty_owned - s.qty_out - s.qty_quarantined) < s.min_stock as below_min
from v_item_stock s;
