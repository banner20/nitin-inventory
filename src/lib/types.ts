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
 * Why a line came back the way it did. Everything except `ok` and `damaged`
 * reduces what the company owns — they are separate so the books can tell
 * normal trading apart from breakage apart from stock nobody can account for.
 */
export type LineCondition = 'ok' | 'damaged' | 'consumed' | 'wasted' | 'lost'
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
}

export type ItemKind = 'returnable' | 'consumable'

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
  event_name: string
  ends_at: string
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
