-- ============================================================================
-- Posting to the ledger
--
-- A transaction header and its lines have to land together or not at all —
-- inserting them as two round trips from the browser leaves an orphan header
-- behind the moment a phone loses signal mid-post.
--
-- Deliberately NOT security definer: this runs as the caller, so every RLS
-- policy on txns and txn_lines still applies. Crew can only sign gear out to
-- themselves; managers can do the rest. The function moves the work into one
-- statement, it does not grant anything.
--
-- p_client_uuid is generated on the device before the request leaves. Posting
-- the same client_uuid twice returns the original transaction instead of
-- creating a second one, so a retry after a dropped connection can never
-- double-issue gear.
-- ============================================================================

create or replace function public.post_txn(
  p_client_uuid uuid,
  p_type        txn_type,
  p_lines       jsonb,
  p_event_id    uuid default null,
  p_person_id   uuid default null,
  p_note        text default null,
  p_source      txn_source default 'manual',
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  existing uuid;
  tid      uuid;
  line     jsonb;
begin
  if p_client_uuid is null then
    raise exception 'client_uuid is required (it is what makes a retry safe)';
  end if;

  -- Idempotent replay.
  select id into existing from public.txns where client_uuid = p_client_uuid;
  if existing is not null then
    return existing;
  end if;

  if coalesce(jsonb_array_length(p_lines), 0) = 0 then
    raise exception 'A transaction needs at least one line';
  end if;

  insert into public.txns (
    client_uuid, type, event_id, person_id, created_by,
    status, source, note, occurred_at
  ) values (
    p_client_uuid, p_type, p_event_id, p_person_id, auth.uid(),
    'posted', coalesce(p_source, 'manual'), nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_occurred_at, now())
  )
  returning id into tid;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.txn_lines (
      txn_id, item_id, qty, condition, from_quarantine, unit_cost, vendor, note
    ) values (
      tid,
      (line ->> 'item_id')::uuid,
      (line ->> 'qty')::integer,
      nullif(line ->> 'condition', '')::line_condition,
      coalesce((line ->> 'from_quarantine')::boolean, false),
      nullif(line ->> 'unit_cost', '')::numeric,
      nullif(trim(coalesce(line ->> 'vendor', '')), ''),
      nullif(trim(coalesce(line ->> 'note', '')), '')
    );
  end loop;

  return tid;
end;
$$;

revoke all on function public.post_txn(uuid, txn_type, jsonb, uuid, uuid, text, txn_source, timestamptz) from public, anon;
grant execute on function public.post_txn(uuid, txn_type, jsonb, uuid, uuid, text, txn_source, timestamptz) to authenticated;

-- Creating an item is a manager action (RLS already enforces that); this just
-- gives the UI a single call that also reports a likely duplicate rather than
-- silently making a second "LED PAR" three characters different from the first.
create or replace function public.find_similar_items(p_name text)
returns table (id uuid, name text, similarity real)
language sql
stable
as $$
  select i.id, i.name, similarity(i.name, p_name) as similarity
  from public.items i
  where i.active
    and (i.name % p_name or lower(i.name) = lower(trim(p_name)))
  order by similarity desc
  limit 5;
$$;

grant execute on function public.find_similar_items(text) to authenticated;
