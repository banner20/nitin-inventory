/**
 * Domain vocabulary. Deliberately hand-written rather than derived from the
 * generated database types: app code should read like the warehouse talks,
 * and these names stay stable even if a column moves.
 */

export type UserRole = 'crew' | 'manager' | 'admin'

/** No generic "adjust" — a correction is stock we found or stock that's gone. */
export type TxnType = 'OUT' | 'IN' | 'ADD' | 'WRITEOFF' | 'REPAIR'
export type TxnStatus = 'draft' | 'posted' | 'void'
export type TxnSource = 'manual' | 'nl' | 'photo' | 'import'
/**
 * Why a line came back the way it did. Everything except `ok`, `loose` and
 * `damaged` reduces what the company owns — they are separate so the books
 * can tell normal trading apart from breakage apart from stock nobody can
 * account for. `loose` is `ok` that isn't a sealed pack any more: an opened
 * bottle with some of it left, tracked separately so "3 sealed bottles" and
 * "1 open bottle with some left" never get flattened into one number.
 */
export type LineCondition = 'ok' | 'loose' | 'damaged' | 'consumed' | 'wasted' | 'lost'
export type EventStatus = 'planned' | 'out' | 'closed' | 'cancelled'

export interface Profile {
  id: string
  emp_code: string
  full_name: string
  phone: string | null
  role: UserRole
  active: boolean
}

export interface Category {
  id: string
  name: string
  sort: number
}

export interface Item {
  id: string
  name: string
  category_id: string | null
  unit: string
  sku: string | null
  min_stock: number
  aliases: string[]
  photo_url: string | null
  notes: string | null
  active: boolean
  kind: ItemKind
  /** How many base units in one pack: a 750ml bottle of gin is 750. */
  pack_size: number
  /** What one pack is called — bottle, crate, bag. Null means loose. */
  pack_label: string | null
  expiry_date: string | null
  /** Current price of one base unit. See ItemAvailability.unit_cost. */
  unit_cost: number | null
  /** Created in a hurry by crew and still carrying placeholder details. */
  needs_review: boolean
}

/**
 * An extra way to count the same item, beyond its default pack — Hazelnut
 * syrup bought as both 250ml bottles (the default) and a 1L jug (an
 * AltPack). Every quantity still lands in the same base-unit ledger; this
 * only changes what the person entering it gets to type against.
 */
export interface AltPack {
  id: string
  pack_size: number
  pack_label: string
  sku: string | null
  /** Price of one base unit when bought in THIS size. Held per size because
   * bulk is normally cheaper per unit than the default pack — a 1L jug at
   * ₹700 is ₹0.70/ml where a 250ml bottle at ₹200 is ₹0.80/ml. */
  unit_cost: number | null
}

/** An item plus its derived stock position. Never stored — always computed. */
export interface ItemAvailability {
  item_id: string
  name: string
  category_id: string | null
  unit: string
  min_stock: number
  active: boolean
  qty_owned: number
  qty_out: number
  qty_quarantined: number
  qty_available: number
  /** Opened/partial stock sitting in unsealed bottles — a subset of
   * qty_available, not extra on top of it. */
  qty_loose: number
  below_min: boolean
  /** Carried through so the UI can search the way people actually talk. */
  aliases: string[]
  sku: string | null
  category_name: string | null
  kind: ItemKind
  /** How many base units in one pack: a 750ml bottle of gin is 750. */
  pack_size: number
  /** What one pack is called — bottle, crate, bag. Null means loose. */
  pack_label: string | null
  /** Extra pack sizes this item is also bought in, beyond the default above. */
  alt_packs: AltPack[] | null
  expiry_date: string | null
  /**
   * Current price of one base unit, used for valuation. Kept up to date by
   * whatever the thing was last actually bought for, and editable by hand for
   * opening balances and corrections.
   */
  unit_cost: number | null
  /** qty_available × unit_cost. Null — not zero — when there's no price on
   * file, so "we don't know what this is worth" stays distinguishable from
   * "it's worth nothing". */
  stock_value: number | null
  /**
   * Quick-added mid-service with a name and nothing else. Flagged so a
   * manager can set the category, unit and pack size before it quietly
   * miscounts itself.
   */
  needs_review: boolean
  /** Read from purchase history, not stored — the last ADD line's vendor,
   * cost, and when. Answers "who did we last buy this from, and for how
   * much" without a static field that can silently go stale. */
  last_vendor: string | null
  last_unit_cost: number | null
  last_purchased_at: string | null
}

/**
 * One line of an event's bill: what went out, what came back, and what the
 * difference cost. Damaged is reported but deliberately not billed — it's
 * still physically owned, just not usable yet, so charging for it here would
 * double-count when it's later repaired or written off.
 */
export interface EventCostLine {
  event_id: string
  event_name: string
  item_id: string
  item_name: string
  unit: string
  kind: ItemKind
  category_name: string | null
  pack_size: number
  pack_label: string | null
  unit_cost: number | null
  qty_out: number
  /** Came back sealed and unopened. */
  qty_returned: number
  /** Came back part-used, in an opened bottle. Still on the shelf, so it
   * counts as returned — it just isn't a full pack any more. */
  qty_returned_loose: number
  /** Everything that physically came back, sealed or not. */
  qty_back_total: number
  qty_consumed: number
  qty_wasted: number
  qty_damaged: number
  qty_lost: number
  still_out: number
  /** Served + spilled + never came back: everything the company no longer has. */
  qty_used: number
  cost_used: number | null
  cost_taken_out: number | null
  cost_back: number | null
}

/** One purchase of an item, for the price trail on the edit form. */
export interface PriceHistoryEntry {
  item_id: string
  occurred_at: string
  unit_cost: number
  qty: number
  line_total: number
  vendor: string | null
  bought_by: string | null
}

/**
 * Money, the way an invoice is written. Prices are held per base unit so a
 * half bottle costs half a bottle, but nobody quotes ₹0.642857 per ml — the
 * pack is what gets bought and what gets read back.
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

/** Price of one whole pack, from the per-base-unit price. */
export function packCost(unitCost: number, item: PackInfo): number {
  const size = item.pack_label && item.pack_size > 1 ? Number(item.pack_size) : 1
  return unitCost * size
}

/** How one pack's price reads: "₹450 per bottle", or "₹12 each" when the
 * item isn't packed. */
export function formatUnitPrice(
  unitCost: number | null | undefined,
  item: PackInfo,
): string {
  if (unitCost == null) return '—'
  const packed = item.pack_label && item.pack_size > 1
  if (!packed) return `${formatMoney(unitCost)} each`
  return `${formatMoney(packCost(unitCost, item))} per ${item.pack_label}`
}

export type ItemKind = 'returnable' | 'consumable'

/**
 * A freshly created item has no history yet, so every derived figure is
 * known without a query: nothing has been bought, taken out, or quarantined.
 * Used so a brand-new item can drop straight into a basket instead of
 * waiting on a round trip to re-fetch the view it would trivially match.
 */
export function toItemAvailability(item: Item, categories: Category[]): ItemAvailability {
  const category = categories.find((c) => c.id === item.category_id)
  return {
    item_id: item.id,
    name: item.name,
    category_id: item.category_id,
    unit: item.unit,
    min_stock: item.min_stock,
    active: item.active,
    qty_owned: 0,
    qty_out: 0,
    qty_quarantined: 0,
    qty_available: 0,
    qty_loose: 0,
    below_min: item.min_stock > 0,
    aliases: item.aliases,
    sku: item.sku,
    category_name: category?.name ?? null,
    kind: item.kind,
    pack_size: item.pack_size,
    pack_label: item.pack_label,
    alt_packs: [],
    expiry_date: item.expiry_date,
    unit_cost: item.unit_cost,
    stock_value: item.unit_cost == null ? null : 0,
    needs_review: item.needs_review,
    last_vendor: null,
    last_unit_cost: null,
    last_purchased_at: null,
  }
}

interface PackInfo {
  unit: string
  pack_size: number
  pack_label: string | null
}

/**
 * Stock is held in a base unit so half a bottle can be represented, but nobody
 * loading a van wants to read "4500 ml". Show packs when the item has them,
 * and keep the exact figure alongside rather than hiding it — a half bottle of
 * gin is real money.
 */
export function formatQty(qty: number, item: PackInfo): string {
  const n = Number(qty)
  // Negative stock is a books-are-wrong signal, not a quantity anyone will
  // count out. "-2 bottles + 225 ml" is arithmetically true and unreadable;
  // show the shortfall as a plain signed number instead.
  if (n < 0) {
    const packs = item.pack_label && item.pack_size > 1 ? -n / item.pack_size : -n
    const unit =
      item.pack_label && item.pack_size > 1 ? plural(item.pack_label, packs) : item.unit
    return `−${trim(packs)} ${unit}`
  }

  const exact = `${trim(n)} ${item.unit}`
  if (!item.pack_label || item.pack_size <= 1) return exact

  const packs = n / item.pack_size
  const whole = Math.floor(packs)
  const remainder = n - whole * item.pack_size

  if (n === 0) return `0 ${plural(item.pack_label, 0)}`
  if (remainder === 0) return `${trim(packs)} ${plural(item.pack_label, packs)}`
  if (whole === 0) return exact
  return `${whole} ${plural(item.pack_label, whole)} + ${trim(remainder)} ${item.unit}`
}

/** Compact form for dense tables: just the pack count. */
export function formatPacks(qty: number, item: PackInfo): string {
  const n = Number(qty)
  if (!item.pack_label || item.pack_size <= 1) return `${trim(n)} ${item.unit}`
  return `${trim(n / item.pack_size)} ${plural(item.pack_label, n / item.pack_size)}`
}

function trim(n: number): string {
  return Number(n.toFixed(3)).toLocaleString('en-IN')
}

function plural(label: string, n: number): string {
  if (Math.abs(n) === 1) return label
  return label.endsWith('s') ? label : `${label}s`
}

/** Does this item match what someone typed, by name, alias or SKU? */
export function itemMatches(item: ItemAvailability, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  if (item.name.toLowerCase().includes(n)) return true
  if (item.sku?.toLowerCase().includes(n)) return true
  return item.aliases.some((a) => a.toLowerCase().includes(n))
}

export interface EventRecord {
  id: string
  name: string
  client: string | null
  venue: string | null
  starts_at: string
  ends_at: string
  status: EventStatus
  notes: string | null
}

export interface Txn {
  id: string
  client_uuid: string
  type: TxnType
  event_id: string | null
  person_id: string | null
  created_by: string
  status: TxnStatus
  source: TxnSource
  note: string | null
  photo_urls: string[]
  occurred_at: string
}

export interface TxnLine {
  id: string
  txn_id: string
  item_id: string
  qty: number
  condition: LineCondition | null
  from_quarantine: boolean
  unit_cost: number | null
  vendor: string | null
  note: string | null
}

/** What someone still owes for an event. The accountability model, in one row. */
export interface OpenBalance {
  event_id: string
  person_id: string
  person_name: string
  item_id: string
  qty_out: number
  qty_back: number
  qty_damaged: number
  qty_lost: number
  qty_returned: number
  qty_consumed: number
  qty_wasted: number
  outstanding: number
  item_name: string
  unit: string
  kind: ItemKind
  pack_size: number
  pack_label: string | null
  alt_packs: AltPack[] | null
  event_name: string
  ends_at: string
  event_created_at: string
  overdue: boolean
}

export interface Kit {
  id: string
  name: string
  description: string | null
  active: boolean
}

export interface KitLine {
  id: string
  kit_id: string
  item_id: string
  qty: number
}

/** A line in the basket before it becomes a transaction. */
export interface DraftLine {
  item_id: string
  name: string
  unit: string
  qty: number
  condition?: LineCondition
  note?: string
}

/** One line within a history entry — enough pack info to format it the same
 * way as everywhere else in the app. */
export interface TxnHistoryLine {
  item_name: string
  unit: string
  qty: number
  condition: LineCondition | null
  from_quarantine: boolean
  unit_cost: number | null
  vendor: string | null
  pack_size: number
  pack_label: string | null
}

/** One row per transaction — who did it, for what, and what it contained. */
export interface TxnHistoryEntry {
  txn_id: string
  type: TxnType
  status: TxnStatus
  /** Who wrote it — the only person besides a manager who may withdraw it. */
  created_by: string | null
  /** Set once withdrawn. The entry stays exactly as written; it just stops
   * counting, so the stock returns to where it was before. */
  voided_at: string | null
  void_reason: string | null
  voided_by_name: string | null
  source: TxnSource
  note: string | null
  occurred_at: string
  created_at: string
  event_name: string | null
  actor_name: string | null
  actor_emp_code: string | null
  person_name: string | null
  person_emp_code: string | null
  lines: TxnHistoryLine[] | null
}
