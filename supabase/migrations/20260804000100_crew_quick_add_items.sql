-- ============================================================================
-- Let crew create a bare-bones item on the spot during Take Out.
--
-- Mid-service, someone reaches for something that was never added to the
-- master sheet — the fix used to be "stop and go find a manager." Crew can
-- now create a minimal item themselves (name only, sensible defaults) so the
-- take-out isn't blocked; a manager fills in category/pack/kind properly
-- later via the master sheet's Edit button.
--
-- Only INSERT opens up. Editing or deleting an item — correcting what crew
-- just quick-added, or anything else — stays manager-only, same as before.
-- ============================================================================

drop policy items_manage on items;

create policy items_insert on items
  for insert to authenticated with check (true);

create policy items_update on items
  for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy items_delete on items
  for delete to authenticated using (public.is_manager());
