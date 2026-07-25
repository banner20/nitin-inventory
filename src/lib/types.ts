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
export type LineCondition = 'ok' | 'damaged' | 'lost'
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
  outstanding: number
  item_name: string
  unit: string
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
