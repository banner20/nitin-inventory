-- ============================================================================
-- Bar stock, not AV gear
--
-- Three assumptions baked into the original schema are wrong for a bar events
-- company:
--
--  1. Quantities were integers. A bottle is 750 ml and a pour is 30 ml; half a
--     litre of syrup and 1.5 kg of ice are ordinary amounts. qty becomes
--     numeric.
--
--  2. Everything was assumed to come back. Spirits, mixers, garnishes and ice
--     are consumed — not returning is the *expected* outcome, not a loss.
--     Items now declare whether they are returnable or consumable.
--
--  3. "Didn't come back" only had blame-shaped answers (damaged / lost). A bar
--     needs to tell legitimate consumption apart from spillage apart from
--     genuinely unaccounted stock — the last of which is what actually matters
--     when the stock is liquor.
--
-- Enum values are added here and only *used* in the next migration: Postgres
-- refuses to use a new enum value in the same transaction that created it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Every derived view reads these columns, and Postgres won't retype a
--    column a view depends on. They are all rebuilt in the next migration,
--    which is also where the new enum values become usable.
-- ---------------------------------------------------------------------------
drop view if exists v_person_liability;
drop view if exists v_open_balances;
drop view if exists v_event_consumption;
drop view if exists v_event_balances;
drop view if exists v_item_availability;
drop view if exists v_item_stock;
drop view if exists v_item_cooccurrence;

-- ---------------------------------------------------------------------------
-- 1. Fractional quantities
-- ---------------------------------------------------------------------------
alter table txn_lines
  alter column qty type numeric(12, 3);

alter table kit_lines
  alter column qty type numeric(12, 3);

alter table items
  alter column min_stock type numeric(12, 3);

-- ---------------------------------------------------------------------------
-- 2. Returnable vs consumable
-- ---------------------------------------------------------------------------
create type item_kind as enum ('returnable', 'consumable');

alter table items
  add column kind item_kind not null default 'consumable';

comment on column items.kind is
  'returnable: glassware, jiggers, bar stations — expected back. '
  'consumable: spirits, mixers, garnishes, ice — expected to be used up.';

-- Everything already in the catalogue was AV/bar equipment, which is
-- returnable. New stock defaults to consumable, which is the common case for
-- a bar company.
update items set kind = 'returnable';

-- A sensible default unit for a bar: bottles and litres rather than "pcs".
alter table items
  alter column unit set default 'ml';

-- ---------------------------------------------------------------------------
-- 3. Richer outcomes for a returned line
-- ---------------------------------------------------------------------------
-- ok        came back fine
-- damaged   came back broken -> quarantine
-- consumed  used up as intended (poured, served) -> normal for consumables
-- wasted    spilled, spoiled, broken in transit -> a cost to watch
-- lost      unaccounted for -> the one that needs a conversation
alter type line_condition add value if not exists 'consumed';
alter type line_condition add value if not exists 'wasted';
