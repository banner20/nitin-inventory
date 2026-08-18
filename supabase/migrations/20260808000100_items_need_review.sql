-- ============================================================================
-- Mark the items crew created mid-service so a manager can finish them off.
--
-- Quick add exists so a take-out isn't blocked by something missing from the
-- master sheet. What it creates is deliberately bare: a name, "pcs", no
-- category, no pack size, consumable by default — because the person holding
-- a crate at 8pm should be typing one thing, not filling a form.
--
-- The cost was that those stubs then looked exactly like properly set-up
-- items. Nothing said "this is a guess" — so a syrup created as 1 loose piece
-- sat in the catalogue counting itself wrongly, and nobody knew to fix it.
-- ============================================================================

alter table items
  add column needs_review boolean not null default false;

comment on column items.needs_review is
  'Created in a hurry (crew quick add) with placeholder details. Set false once someone has confirmed the category, unit and pack size.';

create index items_needs_review_idx on items (needs_review) where needs_review;

-- Anything crew created that never got a category is, by definition, one of
-- these — flag the ones already in the catalogue.
update items
   set needs_review = true
 where active
   and category_id is null;
