-- ============================================================================
-- Anyone can bring stock back. It still says whose it was.
--
-- Crew could only post a movement against themselves, which is right for
-- taking stock out — you sign for what you're carrying, and nobody should be
-- able to put a crate on someone else's name. Returning is the opposite case.
-- The van comes back, the person who loaded it has gone home, and the stock is
-- physically on the shelf. Refusing to record that doesn't protect anyone; it
-- just leaves the books saying Nitish still has six bottles he handed over
-- three days ago, and teaches everyone the app is wrong.
--
-- So IN opens up to any holder, OUT stays restricted to yourself. The balance
-- is still cleared against whoever took it out — person_id doesn't change —
-- and created_by records who actually did the handing in, so the history reads
-- "Arun brought back, on behalf of Nitish" rather than losing either name.
--
-- The asymmetry is deliberate: signing stock out to yourself creates a
-- liability, and bringing it back discharges one. Only the first needs
-- guarding.
-- ============================================================================

drop policy txns_insert_own on txns;

create policy txns_insert_own on txns
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_manager()
      -- Taking stock out: only ever onto your own name.
      or (type = 'OUT' and person_id = auth.uid() and status = 'posted')
      -- Bringing it back: on behalf of whoever is holding it.
      or (type = 'IN' and person_id is not null and status = 'posted')
    )
  );
