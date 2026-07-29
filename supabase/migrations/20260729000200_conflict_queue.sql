-- ============================================================================
-- Conflict queue: duplicate items and a way to actually merge them.
--
-- Merging is not just "delete one row" — history has to stay readable and
-- nothing may violate a unique constraint along the way. So the kept item's
-- name absorbs the merged item's name as an alias (old searches still find
-- it), every txn_lines/kit_lines/recipe_lines row pointing at the merged item
-- is repointed to the kept one, and where that repoint would collide with a
-- row that already exists for the kept item (e.g. the same transaction has a
-- line for both items under the same condition), the quantities are summed
-- into the surviving row instead of erroring. The merged item is deactivated,
-- never deleted — its history and its old name both stay resolvable.
--
-- Not SECURITY DEFINER: every table this touches already has a manager-gated
-- RLS policy, so the calling manager's own privileges are sufficient. The
-- explicit is_manager() check is defence in depth, not the only gate.
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
  and similarity(a.name, b.name) > 0.3
order by similarity desc
limit 200;

create or replace function public.merge_items(p_keep_id uuid, p_remove_id uuid)
returns void
language plpgsql
as $$
declare
  remove_name text;
begin
  if not public.is_manager() then
    raise exception 'Only a manager can merge items'
      using errcode = 'insufficient_privilege';
  end if;

  if p_keep_id = p_remove_id then
    raise exception 'Cannot merge an item with itself';
  end if;

  select name into remove_name from items where id = p_remove_id;
  if remove_name is null then
    raise exception 'No such item to merge';
  end if;

  -- txn_lines: same txn + condition + from_quarantine already exists for the
  -- kept item -> sum quantities and drop the redundant line. Otherwise repoint.
  with conflicts as (
    select r.id as remove_line_id, k.id as keep_line_id, r.qty as remove_qty
    from txn_lines r
    join txn_lines k
      on k.item_id = p_keep_id
     and k.txn_id = r.txn_id
     and k.condition is not distinct from r.condition
     and k.from_quarantine = r.from_quarantine
    where r.item_id = p_remove_id
  )
  update txn_lines k set qty = k.qty + c.remove_qty
  from conflicts c where k.id = c.keep_line_id;

  with conflicts as (
    select r.id as remove_line_id
    from txn_lines r
    join txn_lines k
      on k.item_id = p_keep_id
     and k.txn_id = r.txn_id
     and k.condition is not distinct from r.condition
     and k.from_quarantine = r.from_quarantine
    where r.item_id = p_remove_id
  )
  delete from txn_lines r using conflicts c where r.id = c.remove_line_id;

  update txn_lines set item_id = p_keep_id where item_id = p_remove_id;

  -- kit_lines: same kit already has the kept item -> sum quantities.
  with conflicts as (
    select r.id as remove_line_id, k.id as keep_line_id, r.qty as remove_qty
    from kit_lines r
    join kit_lines k on k.item_id = p_keep_id and k.kit_id = r.kit_id
    where r.item_id = p_remove_id
  )
  update kit_lines k set qty = k.qty + c.remove_qty
  from conflicts c where k.id = c.keep_line_id;

  with conflicts as (
    select r.id as remove_line_id
    from kit_lines r
    join kit_lines k on k.item_id = p_keep_id and k.kit_id = r.kit_id
    where r.item_id = p_remove_id
  )
  delete from kit_lines r using conflicts c where r.id = c.remove_line_id;

  update kit_lines set item_id = p_keep_id where item_id = p_remove_id;

  -- recipe_lines: same recipe already calls for the kept item -> sum.
  with conflicts as (
    select r.id as remove_line_id, k.id as keep_line_id, r.qty as remove_qty
    from recipe_lines r
    join recipe_lines k on k.item_id = p_keep_id and k.recipe_id = r.recipe_id
    where r.item_id = p_remove_id
  )
  update recipe_lines k set qty = k.qty + c.remove_qty
  from conflicts c where k.id = c.keep_line_id;

  with conflicts as (
    select r.id as remove_line_id
    from recipe_lines r
    join recipe_lines k on k.item_id = p_keep_id and k.recipe_id = r.recipe_id
    where r.item_id = p_remove_id
  )
  delete from recipe_lines r using conflicts c where r.id = c.remove_line_id;

  update recipe_lines set item_id = p_keep_id where item_id = p_remove_id;

  -- The merged item's old name becomes an alias, so a search for it still
  -- resolves to the survivor. Aliases from the merged item come along too.
  update items keep
  set aliases = (
    select array_agg(distinct a) from unnest(
      keep.aliases || remove.aliases || array[lower(remove_name)]
    ) as a
  )
  from items remove
  where keep.id = p_keep_id and remove.id = p_remove_id;

  -- Deactivate, never delete: the merged item's history stays readable.
  update items set active = false where id = p_remove_id;
end;
$$;

revoke all on function public.merge_items(uuid, uuid) from public, anon;
grant execute on function public.merge_items(uuid, uuid) to authenticated;
