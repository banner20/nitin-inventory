-- ============================================================================
-- What can't repeat on an item is a pack SIZE, not a pack NAME.
--
-- The unique index was on (item_id, lower(pack_label)), which reads as "an
-- item can't have two packs called the same thing". But a syrup stocked as
-- 1L, 700ml, 500ml and 250ml bottles has four packs that are all, correctly,
-- called "bottle" — while nothing stops the same size being entered twice
-- under two different names, which is the duplicate that actually matters.
--
-- The constraint was backwards, and it forced invented labels like "size 2",
-- "big bottle" and "litre" onto sizes that are just bottles.
-- ============================================================================

drop index item_packs_item_label_unique;

create unique index item_packs_item_size_unique
  on item_packs (item_id, pack_size);

comment on index item_packs_item_size_unique is
  'One row per size per item. Names may repeat — four bottle sizes are all called "bottle" — but a size cannot be listed twice.';
