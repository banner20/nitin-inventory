-- ============================================================================
-- Nitin Inventory — core schema
--
-- Design rule that everything else follows from: stock is NEVER a stored
-- counter. Every movement is an immutable row in txns/txn_lines, and current
-- stock is derived. That gives us a real audit trail, safe offline replay,
-- and automatic shortage reports without anyone scanning anything.
--
--   qty_owned       = ADD − WRITEOFF − IN(lost)
--   qty_out         = OUT − IN(any condition)
--   qty_quarantined = IN(damaged) − REPAIR − WRITEOFF(from_quarantine)
--   available       = qty_owned − qty_out − qty_quarantined
--
-- A mistake is corrected by voiding the transaction and posting a new one,
-- never by editing history.
-- ============================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('crew', 'manager', 'admin');

-- No generic "ADJUST": a correction is either stock we found (ADD) or stock
-- that is gone (WRITEOFF). Keeping the vocabulary honest keeps the maths honest.
create type txn_type as enum ('OUT', 'IN', 'ADD', 'WRITEOFF', 'REPAIR');

create type txn_status as enum ('draft', 'posted', 'void');
create type txn_source as enum ('manual', 'nl', 'photo', 'import');
create type line_condition as enum ('ok', 'damaged', 'lost');
create type event_status as enum ('planned', 'out', 'closed', 'cancelled');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  emp_code    text not null unique,
  full_name   text not null,
  phone       text,
  role        user_role not null default 'crew',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint emp_code_format check (emp_code ~ '^[A-Za-z0-9_-]{2,32}$')
);

-- SECURITY DEFINER so that policies on `profiles` can ask "what is my role?"
-- without recursively triggering those same policies.
create or replace function public.my_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'crew'::user_role);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('manager', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- Master sheet
-- ---------------------------------------------------------------------------
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  sort  integer not null default 0
);

create table items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category_id  uuid references categories (id) on delete set null,
  unit         text not null default 'pcs',
  sku          text unique,
  min_stock    integer not null default 0 check (min_stock >= 0),
  aliases      text[] not null default '{}',
  photo_url    text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Full-text over name + sku + aliases. 'simple' rather than 'english' so
  -- that "PAR" isn't stemmed into something unrecognisable.
  search_vec   tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || array_to_string(aliases, ' ')
    )
  ) stored
);

-- Blocks exact case-insensitive duplicates outright. Near-duplicates
-- ("LED PAR 64" vs "led par64") are deliberately allowed through and surface
-- in the admin conflict queue for a human merge.
create unique index items_name_unique on items (lower(name));
create index items_search_idx on items using gin (search_vec);
create index items_name_trgm_idx on items using gin (name gin_trgm_ops);
create index items_category_idx on items (category_id);

create table kits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table kit_lines (
  id      uuid primary key default gen_random_uuid(),
  kit_id  uuid not null references kits (id) on delete cascade,
  item_id uuid not null references items (id) on delete restrict,
  qty     integer not null check (qty > 0),
  unique (kit_id, item_id)
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client      text,
  venue       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      event_status not null default 'planned',
  notes       text,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint event_dates_sane check (ends_at >= starts_at)
);

create index events_dates_idx on events (starts_at, ends_at);
create index events_status_idx on events (status);

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------
create table txns (
  id           uuid primary key default gen_random_uuid(),
  -- Generated on the device before the request leaves. The unique constraint
  -- is what makes a flaky-connection retry idempotent instead of a double
  -- checkout, so it is NOT nullable.
  client_uuid  uuid not null unique,
  type         txn_type not null,
  event_id     uuid references events (id) on delete restrict,
  person_id    uuid references profiles (id) on delete restrict,
  created_by   uuid not null references profiles (id) on delete restrict,
  status       txn_status not null default 'posted',
  source       txn_source not null default 'manual',
  note         text,
  photo_urls   text[] not null default '{}',
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- Gear movements are always tied to an event and a person; stock
  -- corrections never are.
  constraint movement_has_event_and_person check (
    (type in ('OUT', 'IN') and event_id is not null and person_id is not null)
    or (type in ('ADD', 'WRITEOFF', 'REPAIR'))
  )
);

create index txns_event_idx on txns (event_id);
create index txns_person_idx on txns (person_id);
create index txns_type_status_idx on txns (type, status);
create index txns_occurred_idx on txns (occurred_at desc);

create table txn_lines (
  id              uuid primary key default gen_random_uuid(),
  txn_id          uuid not null references txns (id) on delete cascade,
  item_id         uuid not null references items (id) on delete restrict,
  qty             integer not null check (qty > 0),
  -- IN only: did it come back fine, broken, or not at all?
  condition       line_condition,
  -- WRITEOFF only: scrapping a quarantined item vs one still on the shelf.
  from_quarantine boolean not null default false,
  -- ADD only: gives us price history and a real reorder list.
  unit_cost       numeric(12, 2) check (unit_cost is null or unit_cost >= 0),
  vendor          text,
  note            text
);

create index txn_lines_txn_idx on txn_lines (txn_id);
create index txn_lines_item_idx on txn_lines (item_id);

-- One line per item per condition. Forces the UI to merge quantities rather
-- than silently stacking two lines for the same thing.
create unique index txn_lines_unique_item
  on txn_lines (txn_id, item_id, coalesce(condition::text, '-'), from_quarantine);

-- Enforce the per-type shape of a line. Cheaper to reject here than to explain
-- a nonsensical report later.
create or replace function public.check_txn_line_shape()
returns trigger
language plpgsql
as $$
declare
  parent_type txn_type;
begin
  select type into parent_type from public.txns where id = new.txn_id;

  if parent_type = 'IN' and new.condition is null then
    raise exception 'IN lines must state a condition (ok/damaged/lost)';
  end if;

  if parent_type <> 'IN' and new.condition is not null then
    raise exception 'condition is only meaningful on IN lines';
  end if;

  if parent_type <> 'ADD' and (new.unit_cost is not null or new.vendor is not null) then
    raise exception 'unit_cost/vendor are only meaningful on ADD lines';
  end if;

  if parent_type <> 'WRITEOFF' and new.from_quarantine then
    raise exception 'from_quarantine is only meaningful on WRITEOFF lines';
  end if;

  return new;
end;
$$;

create trigger txn_lines_shape
  before insert or update on txn_lines
  for each row execute function public.check_txn_line_shape();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

create index audit_entity_idx on audit_log (entity, entity_id);
create index audit_at_idx on audit_log (at desc);

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_items after insert or update or delete on items
  for each row execute function public.write_audit();
create trigger audit_txns after insert or update or delete on txns
  for each row execute function public.write_audit();
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_touch before update on items
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on events
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Derived views. security_invoker so they respect the caller's RLS rather
-- than running as the view owner — without this, any view is an RLS bypass.
-- ============================================================================

create view v_item_stock
with (security_invoker = on) as
select
  i.id                                       as item_id,
  i.name,
  i.category_id,
  i.unit,
  i.min_stock,
  i.active,
  coalesce(sum(case
    when t.type = 'ADD' then l.qty
    when t.type = 'WRITEOFF' then -l.qty
    when t.type = 'IN' and l.condition = 'lost' then -l.qty
  end), 0)::integer                          as qty_owned,
  coalesce(sum(case
    when t.type = 'OUT' then l.qty
    when t.type = 'IN' then -l.qty
  end), 0)::integer                          as qty_out,
  coalesce(sum(case
    when t.type = 'IN' and l.condition = 'damaged' then l.qty
    when t.type = 'REPAIR' then -l.qty
    when t.type = 'WRITEOFF' and l.from_quarantine then -l.qty
  end), 0)::integer                          as qty_quarantined
from items i
left join txn_lines l on l.item_id = i.id
left join txns t on t.id = l.txn_id and t.status = 'posted'
group by i.id;

-- Convenience wrapper so callers never re-derive `available` by hand.
create view v_item_availability
with (security_invoker = on) as
select
  s.*,
  (s.qty_owned - s.qty_out - s.qty_quarantined)::integer as qty_available,
  (s.qty_owned - s.qty_out - s.qty_quarantined) < s.min_stock as below_min
from v_item_stock s;

-- Who owes what, per event and person. The whole accountability model in
-- one view: OUT minus IN, anything left over is still in someone's van.
create view v_event_balances
with (security_invoker = on) as
select
  t.event_id,
  t.person_id,
  l.item_id,
  coalesce(sum(case when t.type = 'OUT' then l.qty else 0 end), 0)::integer as qty_out,
  coalesce(sum(case when t.type = 'IN' then l.qty else 0 end), 0)::integer  as qty_back,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'damaged' then l.qty else 0 end), 0)::integer as qty_damaged,
  coalesce(sum(case when t.type = 'IN' and l.condition = 'lost' then l.qty else 0 end), 0)::integer    as qty_lost,
  coalesce(sum(case when t.type = 'OUT' then l.qty else -l.qty end), 0)::integer as outstanding
from txns t
join txn_lines l on l.txn_id = t.id
where t.status = 'posted' and t.type in ('OUT', 'IN')
group by t.event_id, t.person_id, l.item_id;

create view v_open_balances
with (security_invoker = on) as
select
  b.*,
  i.name    as item_name,
  i.unit,
  e.name    as event_name,
  e.ends_at,
  (now() > e.ends_at) as overdue
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
where b.outstanding > 0;

create view v_person_liability
with (security_invoker = on) as
select
  person_id,
  count(distinct event_id)::integer as open_events,
  sum(outstanding)::integer         as items_outstanding,
  count(*) filter (where overdue)::integer as overdue_lines
from v_open_balances
group by person_id;

-- "You usually also take…" — pure SQL, no AI cost. Counts how often two items
-- left for the same event.
create view v_item_cooccurrence
with (security_invoker = on) as
with event_items as (
  select distinct t.event_id, l.item_id
  from txns t
  join txn_lines l on l.txn_id = t.id
  where t.status = 'posted' and t.type = 'OUT' and t.event_id is not null
)
select
  a.item_id,
  b.item_id                as other_item_id,
  count(*)::integer        as events_together
from event_items a
join event_items b on a.event_id = b.event_id and a.item_id <> b.item_id
group by a.item_id, b.item_id;

-- ============================================================================
-- Row level security
-- ============================================================================
alter table profiles   enable row level security;
alter table categories enable row level security;
alter table items      enable row level security;
alter table kits       enable row level security;
alter table kit_lines  enable row level security;
alter table events     enable row level security;
alter table txns       enable row level security;
alter table txn_lines  enable row level security;
alter table audit_log  enable row level security;

-- Profiles: an internal staff directory. Everyone can see who's who (you need
-- names on a gate pass); only managers can change roles or deactivate people.
create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
create policy profiles_manage on profiles
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Reference data: everyone reads, managers write.
create policy categories_select on categories for select to authenticated using (true);
create policy categories_manage on categories for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy items_select on items for select to authenticated using (true);
create policy items_manage on items for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy kits_select on kits for select to authenticated using (true);
create policy kits_manage on kits for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy kit_lines_select on kit_lines for select to authenticated using (true);
create policy kit_lines_manage on kit_lines for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy events_select on events for select to authenticated using (true);
create policy events_manage on events for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- The ledger. Crew see only their own movements; managers see everything.
create policy txns_select on txns
  for select to authenticated
  using (public.is_manager() or person_id = auth.uid() or created_by = auth.uid());

-- Crew may only sign gear out to themselves, and only as a real movement.
-- Anything that changes what the company owns is manager-only.
create policy txns_insert_own on txns
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_manager()
      or (type in ('OUT', 'IN') and person_id = auth.uid() and status = 'posted')
    )
  );

-- Posted history is immutable for crew — voiding is a manager decision.
create policy txns_update_manager on txns
  for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy txns_delete_manager on txns
  for delete to authenticated using (public.is_manager());

create policy txn_lines_select on txn_lines
  for select to authenticated
  using (exists (select 1 from txns t where t.id = txn_lines.txn_id));

create policy txn_lines_insert on txn_lines
  for insert to authenticated
  with check (exists (
    select 1 from txns t
    where t.id = txn_lines.txn_id
      and (public.is_manager() or t.created_by = auth.uid())
  ));

create policy txn_lines_manage on txn_lines
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Audit log is manager-readable and append-only via SECURITY DEFINER triggers.
create policy audit_select on audit_log
  for select to authenticated using (public.is_manager());
