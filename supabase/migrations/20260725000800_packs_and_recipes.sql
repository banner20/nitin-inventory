-- ============================================================================
-- Pack sizes, and recipes
--
-- Pack sizes exist because of a UX problem, not a data one. Stock has to be
-- held in a base unit (ml) so half a bottle coming back is representable, but
-- nobody loading a van at 6am wants to type "4500". So each item knows how big
-- one pack is — Tanqueray is 750 ml to a bottle — and the app lets people work
-- in bottles while the ledger stays in millilitres.
--
-- Recipes are deliberately a side table: they describe what a drink *should*
-- use, and nothing in the stock ledger depends on them. That keeps the main
-- in/out flow working whether or not anyone ever fills the recipe book in.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Packs
-- ---------------------------------------------------------------------------
alter table items
  add column pack_size numeric(12, 3) not null default 1
    check (pack_size > 0),
  add column pack_label text;

comment on column items.pack_size is
  'How many base units in one pack. A 750ml bottle of gin is unit=ml, '
  'pack_size=750, pack_label=bottle. Loose items are pack_size=1.';

comment on column items.pack_label is
  'What one pack is called: bottle, case, bag, jar. Null means the item is '
  'simply counted in its base unit.';

-- Surface it on the stock views so screens can show "6 bottles (4500 ml)"
-- without a second query.
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
  i.pack_label
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

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table recipes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  glass       text,
  garnish     text,
  method      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index recipes_name_unique on recipes (lower(name));

create table recipe_lines (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  item_id   uuid not null references items (id) on delete restrict,
  -- In the item's base unit: 60 ml of gin, 1 pcs of lime wedge.
  qty       numeric(12, 3) not null check (qty > 0),
  note      text,
  unique (recipe_id, item_id)
);

create index recipe_lines_recipe_idx on recipe_lines (recipe_id);
create index recipe_lines_item_idx on recipe_lines (item_id);

create trigger recipes_touch before update on recipes
  for each row execute function public.touch_updated_at();

alter table recipes enable row level security;
alter table recipe_lines enable row level security;

create policy recipes_select on recipes for select to authenticated using (true);
create policy recipes_manage on recipes for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy recipe_lines_select on recipe_lines for select to authenticated using (true);
create policy recipe_lines_manage on recipe_lines for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- What one serve costs, and whether you can currently make it. Recipes stay
-- advisory — this reads the ledger, the ledger never reads recipes.
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
