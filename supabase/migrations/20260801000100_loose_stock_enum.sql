-- ============================================================================
-- Sealed vs loose stock.
--
-- A 500ml syrup bottle taken out and used halfway doesn't come back as "500ml
-- available" the same way an untouched sealed bottle does — it's an opened
-- bottle with some liquid left in it, not a fresh pack you can hand someone
-- expecting a full size. The master sheet and Take Out need to tell these
-- apart: "3 sealed 500ml bottles" is a different, more useful fact than "1500
-- ml available" when some of that 1500ml is really one open bottle with 250ml
-- left in it.
--
-- 'loose' is a new IN condition alongside ok/consumed/wasted/damaged/lost:
-- physically still owned (unlike consumed/wasted/lost) but not a sealed pack
-- (unlike ok). from_loose mirrors from_quarantine's existing pattern — it
-- marks an OUT line as drawing from the loose pool instead of fresh sealed
-- stock, the same way from_quarantine marks a WRITEOFF as coming from
-- quarantine instead of the shelf.
--
-- New enum values can't be used in the same transaction that adds them, so
-- the views/RPC that actually read 'loose' are a separate migration that
-- follows this one.
-- ============================================================================

alter type line_condition add value if not exists 'loose';

alter table txn_lines
  add column from_loose boolean not null default false;

comment on column txn_lines.from_loose is
  'OUT only: this line is drawing from an item''s loose (opened, partial) pool rather than sealed stock.';

drop index txn_lines_unique_item;
create unique index txn_lines_unique_item
  on txn_lines (txn_id, item_id, condition, from_quarantine, from_loose)
  nulls not distinct;

create or replace function public.check_txn_line_shape()
returns trigger
language plpgsql
as $$
declare
  parent_type txn_type;
begin
  select type into parent_type from public.txns where id = new.txn_id;

  if parent_type = 'IN' and new.condition is null then
    raise exception 'IN lines must state a condition (ok/loose/damaged/consumed/wasted/lost)';
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

  if parent_type <> 'OUT' and new.from_loose then
    raise exception 'from_loose is only meaningful on OUT lines';
  end if;

  return new;
end;
$$;
