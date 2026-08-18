-- ============================================================================
-- Carry needs_review through to the app.
--
-- v_item_stock lists its columns one by one rather than selecting i.*, so a
-- new column on items is invisible until the view is rebuilt. Everything
-- below is unchanged apart from the one added column.
-- ============================================================================

drop view if exists v_recipe_requirements;
drop view if exists v_item_availability;
drop view if exists v_item_stock;

create view v_item_stock
with (security_invoker = on) as
select
  i.id as item_id, i.name, i.category_id, i.unit, i.min_stock, i.active,
  coalesce(sum(case when t.type='ADD' then l.qty when t.type='WRITEOFF' then -l.qty
    when t.type='IN' and l.condition in ('lost','consumed','wasted') then -l.qty end),0)::numeric(12,3) as qty_owned,
  coalesce(sum(case when t.type='OUT' then l.qty when t.type='IN' then -l.qty end),0)::numeric(12,3) as qty_out,
  coalesce(sum(case when t.type='IN' and l.condition='damaged' then l.qty
    when t.type='REPAIR' then -l.qty when t.type='WRITEOFF' and l.from_quarantine then -l.qty end),0)::numeric(12,3) as qty_quarantined,
  coalesce(sum(case when t.type='IN' and l.condition='loose' then l.qty
    when t.type='OUT' and l.from_loose then -l.qty end),0)::numeric(12,3) as qty_loose,
  i.aliases, i.sku, c.name as category_name, i.kind, i.pack_size, i.pack_label,
  i.expiry_date, i.unit_cost, i.needs_review,
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
