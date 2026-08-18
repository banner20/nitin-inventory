-- ============================================================================
-- Undoing a mistake, without rewriting what happened.
--
-- Someone records a return, then realises they typed the wrong thing — five
-- bottles instead of two, or served when it was actually spilled. The obvious
-- fix is to let them edit the entry. That would be a mistake: this ledger's
-- whole value is that it is append-only, so "what did the count say last
-- Tuesday" always has an answer. An edit silently changes the past and takes
-- that away.
--
-- So a wrong entry is voided rather than altered. The row stays exactly as it
-- was written, with who wrote it and when; it is simply no longer counted.
-- Every view already reads `status = 'posted'`, so voiding one puts the stock
-- straight back to where it was before — still out against the same person —
-- and the corrected version is recorded as a fresh entry. History then shows
-- both: the mistake, struck through, and the correction beside it.
--
-- Who may: managers, anything. Everyone else, only entries they wrote
-- themselves — fixing your own slip needs no permission, and undoing someone
-- else's is a decision, not a typo.
-- ============================================================================

alter table txns
  add column voided_at   timestamptz,
  add column voided_by   uuid references profiles (id),
  add column void_reason text;

comment on column txns.voided_at is
  'When this entry was withdrawn. The entry itself is never edited — voiding stops it counting while leaving the record of what was originally written.';

create or replace function public.void_txn(p_txn_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  select * into t from public.txns where id = p_txn_id;

  if not found then
    raise exception 'No such entry';
  end if;

  if t.status <> 'posted' then
    raise exception 'That entry has already been withdrawn';
  end if;

  -- Your own slip is yours to fix. Someone else's is a manager's call.
  if not public.is_manager() and t.created_by <> auth.uid() then
    raise exception 'Only the person who recorded this, or a manager, can undo it';
  end if;

  update public.txns
     set status      = 'void',
         voided_at   = now(),
         voided_by   = auth.uid(),
         void_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_txn_id;
end;
$$;

revoke all on function public.void_txn(uuid, text) from public, anon;
grant execute on function public.void_txn(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Surface the void on the history view, so the UI can strike it through and
-- say who withdrew it.
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
  voider.full_name as voided_by_name,
  e.name          as event_name,
  actor.full_name as actor_name,
  actor.emp_code  as actor_emp_code,
  person.full_name as person_name,
  person.emp_code as person_emp_code,
  (
    select jsonb_agg(
      jsonb_build_object(
        'item_name', i.name,
        'unit', i.unit,
        'qty', l.qty,
        'condition', l.condition,
        'from_quarantine', l.from_quarantine,
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
