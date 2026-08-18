-- ============================================================================
-- Editing an entry, done honestly.
--
-- Undo-then-redo keeps the ledger truthful but costs two steps, and the second
-- one is easy to forget — which leaves the stock sitting as "still out" and
-- the books worse than before the correction started. One button is the right
-- interface. It just mustn't be implemented as an overwrite.
--
-- So amending writes the correction and withdraws the original in one
-- transaction: the old row survives untouched and stops counting, the new one
-- carries the fixed numbers, and replaces_txn_id ties them together so history
-- can say "corrects an earlier entry" rather than showing two unrelated
-- movements. Nothing is lost and nobody has to remember step two.
--
-- Everything about the original except the lines is carried over — the same
-- event, the same holder, the same date it happened. An amendment corrects
-- what was recorded, not when or whose it was.
-- ============================================================================

alter table txns
  add column replaces_txn_id uuid references txns (id);

comment on column txns.replaces_txn_id is
  'This entry supersedes an earlier one that was recorded wrongly. The earlier row is voided, never edited, so both the mistake and the correction stay readable.';

create index txns_replaces_idx on txns (replaces_txn_id) where replaces_txn_id is not null;

create or replace function public.amend_txn(
  p_txn_id uuid,
  p_lines  jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  old_txn record;
  new_id  uuid;
  line    jsonb;
begin
  select * into old_txn from public.txns where id = p_txn_id;

  if not found then
    raise exception 'No such entry';
  end if;

  if old_txn.status <> 'posted' then
    raise exception 'That entry has already been withdrawn';
  end if;

  -- Same rule as withdrawing: your own slip, or a manager's call.
  if not public.is_manager() and old_txn.created_by <> auth.uid() then
    raise exception 'Only the person who recorded this, or a manager, can change it';
  end if;

  if coalesce(jsonb_array_length(p_lines), 0) = 0 then
    raise exception 'An entry needs at least one line — withdraw it instead of emptying it';
  end if;

  -- The correction first, so a failure anywhere leaves the original standing.
  insert into public.txns (
    client_uuid, type, event_id, person_id, created_by, status, source,
    note, occurred_at, replaces_txn_id
  ) values (
    gen_random_uuid(), old_txn.type, old_txn.event_id, old_txn.person_id,
    auth.uid(), 'posted', old_txn.source,
    old_txn.note, old_txn.occurred_at, p_txn_id
  )
  returning id into new_id;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.txn_lines (
      txn_id, item_id, qty, condition, from_quarantine, from_loose,
      unit_cost, vendor, note, pack_id
    ) values (
      new_id,
      (line ->> 'item_id')::uuid,
      (line ->> 'qty')::numeric(12,3),
      nullif(line ->> 'condition', '')::line_condition,
      coalesce((line ->> 'from_quarantine')::boolean, false),
      coalesce((line ->> 'from_loose')::boolean, false),
      nullif(line ->> 'unit_cost', '')::numeric(14,6),
      nullif(trim(coalesce(line ->> 'vendor', '')), ''),
      nullif(trim(coalesce(line ->> 'note', '')), ''),
      case
        when nullif(line ->> 'pack_id', '') is null then null
        when (line ->> 'pack_id') = 'default' then null
        else (line ->> 'pack_id')::uuid
      end
    );
  end loop;

  update public.txns
     set status      = 'void',
         voided_at   = now(),
         voided_by   = auth.uid(),
         void_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Corrected')
   where id = p_txn_id;

  return new_id;
end;
$$;

revoke all on function public.amend_txn(uuid, jsonb, text) from public, anon;
grant execute on function public.amend_txn(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Show the link both ways, so a corrected entry says so and the correction
-- says what it replaced.
-- ---------------------------------------------------------------------------

drop view if exists v_txn_history;

create view v_txn_history
with (security_invoker = on) as
select
  t.id            as txn_id,
  t.type,
  t.status,
  t.source,
  t.note,
  t.occurred_at,
  t.created_at,
  t.created_by,
  t.voided_at,
  t.void_reason,
  t.replaces_txn_id,
  (select true from txns r where r.replaces_txn_id = t.id limit 1) as was_corrected,
  voider.full_name as voided_by_name,
  e.name          as event_name,
  actor.full_name as actor_name,
  actor.emp_code  as actor_emp_code,
  person.full_name as person_name,
  person.emp_code as person_emp_code,
  (
    select jsonb_agg(
      jsonb_build_object(
        'item_id', i.id,
        'item_name', i.name,
        'unit', i.unit,
        'qty', l.qty,
        'condition', l.condition,
        'from_quarantine', l.from_quarantine,
        'from_loose', l.from_loose,
        'unit_cost', l.unit_cost,
        'vendor', l.vendor,
        'pack_size', i.pack_size,
        'pack_label', i.pack_label
      )
      order by i.name
    )
    from txn_lines l
    join items i on i.id = l.item_id
    where l.txn_id = t.id
  ) as lines,
  lower(concat_ws(' ',
    e.name,
    actor.full_name, actor.emp_code,
    person.full_name, person.emp_code,
    t.note,
    (select string_agg(distinct i.name, ' ')
     from txn_lines l join items i on i.id = l.item_id
     where l.txn_id = t.id),
    (select string_agg(distinct l.vendor, ' ')
     from txn_lines l where l.txn_id = t.id and l.vendor is not null)
  )) as search_text
from txns t
left join events e on e.id = t.event_id
left join profiles actor on actor.id = t.created_by
left join profiles person on person.id = t.person_id
left join profiles voider on voider.id = t.voided_by
order by t.occurred_at desc;
