-- ============================================================================
-- Let crew start a job.
--
-- Events were manager-only to create, which means the person actually loading
-- the van at 6am for a booking nobody entered yet is blocked by someone else's
-- availability. That is how a system stops getting used: the first time it
-- refuses to let you record what you are physically doing, you go back to
-- WhatsApp.
--
-- So: anyone signed in may create an event, and it is stamped with who created
-- it. Editing, closing and cancelling stay manager-only — anyone can start a
-- job, only a manager can rewrite one.
-- ============================================================================

create policy events_insert_any on events
  for insert to authenticated
  with check (created_by = auth.uid());
