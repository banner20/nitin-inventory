-- ============================================================================
-- Raise the duplicate-detection threshold from 0.3 to 0.55.
--
-- Calibrated against the live catalogue: same-category items that are
-- genuinely different things ("Sweet Vermouth" / "Dry Vermouth", "White Rum" /
-- "White Wine", "Rocks Glass" / "Glass Rack") share enough letters to score up
-- to 0.474 — comfortably above the old 0.3 cutoff, which made the conflict
-- queue's duplicate list mostly noise. Real near-duplicates (a case change, a
-- stray hyphen, a doubled space, "64" vs "-64") scored 0.6-1.0 in the same
-- test. 0.55 sits in the gap between them.
--
-- find_similar_items() gets the same fix so the add-item warning matches what
-- the conflict queue considers worth a look — a threshold this app applies in
-- two places should not quietly disagree with itself.
-- ============================================================================

create or replace view v_item_duplicate_candidates
with (security_invoker = on) as
select
  a.id   as item_a_id,
  a.name as item_a_name,
  b.id   as item_b_id,
  b.name as item_b_name,
  similarity(a.name, b.name) as similarity
from items a
join items b on a.id < b.id
where a.active and b.active
  and similarity(a.name, b.name) > 0.55
order by similarity desc
limit 200;

create or replace function public.find_similar_items(p_name text)
returns table (id uuid, name text, similarity real)
language sql
stable
as $$
  select i.id, i.name, similarity(i.name, p_name) as similarity
  from public.items i
  where i.active
    and (similarity(i.name, p_name) > 0.55 or lower(i.name) = lower(trim(p_name)))
  order by similarity desc
  limit 5;
$$;
