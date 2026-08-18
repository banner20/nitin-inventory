import { supabase } from './supabase'
import type {
  EventCostLine,
  ItemAvailability,
  OpenBalance,
  PriceHistoryEntry,
  Profile,
  TxnHistoryEntry,
  TxnType,
} from './types'

/**
 * Every read goes through here so the rest of the app never writes a raw
 * table name, and so the shape crossing into React is a domain type rather
 * than whatever PostgREST happened to return.
 */

export async function fetchMyOpenBalances(personId: string): Promise<OpenBalance[]> {
  const { data, error } = await supabase
    .from('v_open_balances')
    .select('*')
    .eq('person_id', personId)
    .order('ends_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OpenBalance[]
}

export async function fetchAllOpenBalances(): Promise<OpenBalance[]> {
  const { data, error } = await supabase
    .from('v_open_balances')
    .select('*')
    .order('ends_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OpenBalance[]
}

/** Stock still out past its event's end date — the conflict queue's aging list. */
export async function fetchOverdueBalances(): Promise<OpenBalance[]> {
  const { data, error } = await supabase
    .from('v_open_balances')
    .select('*')
    .eq('overdue', true)
    .order('ends_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OpenBalance[]
}

export async function fetchItemAvailability(): Promise<ItemAvailability[]> {
  const { data, error } = await supabase
    .from('v_item_availability')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return (data ?? []) as ItemAvailability[]
}

/** Items expiring within 60 days or already past — the conflict queue's
 * "Expiring soon" list, soonest first. */
export async function fetchExpiringItems(): Promise<ItemAvailability[]> {
  const cutoff = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('v_item_availability')
    .select('*')
    .eq('active', true)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  return (data ?? []) as ItemAvailability[]
}

/**
 * Every stock action with who did it, newest first. Paged rather than
 * loaded in full — a busy bar generates a transaction every few minutes
 * during service, and this history only grows.
 */
export async function fetchTxnHistory(
  offset: number,
  limit: number,
  type?: TxnType,
  search?: string,
): Promise<TxnHistoryEntry[]> {
  let query = supabase
    .from('v_txn_history')
    .select('*')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)

  // Searched in the database, across everything, rather than filtering the
  // page already on screen — otherwise anything past the first page reports
  // "nothing matches", which reads as proof it never happened.
  const needle = search?.trim().toLowerCase()
  if (needle) {
    query = query.ilike('search_text', `%${needle}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TxnHistoryEntry[]
}

/**
 * What one item has actually been bought for, newest first. The price trail
 * behind the single "current price" figure — bought at ₹100 in June and ₹120
 * in August is a fact worth being able to see.
 */
export async function fetchPriceHistory(itemId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('v_item_price_history')
    .select('*')
    .eq('item_id', itemId)
    .order('occurred_at', { ascending: false })
    .limit(12)

  if (error) throw error
  return (data ?? []) as PriceHistoryEntry[]
}

/** Every item touched by one event, with what it cost. The accounts report. */
export async function fetchEventCosts(eventId: string): Promise<EventCostLine[]> {
  const { data, error } = await supabase
    .from('v_event_costs')
    .select('*')
    .eq('event_id', eventId)
    .order('item_name')

  if (error) throw error
  return (data ?? []) as EventCostLine[]
}

/**
 * Did a previous attempt with this key actually land?
 *
 * The ledger keys every transaction by the id the device generated, so a
 * request that succeeded just as the signal died can be recognised after the
 * fact — which is the difference between "save it again" and "it's already
 * saved, stop worrying".
 */
export async function findTxnByClientUuid(clientUuid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('txns')
    .select('id')
    .eq('client_uuid', clientUuid)
    .maybeSingle()

  if (error) return null
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Withdraw an entry that was recorded wrongly.
 *
 * Nothing is edited or deleted — the entry stays exactly as it was written,
 * marked void, and simply stops counting. Whatever it moved goes back to where
 * it was, so the corrected version can be recorded fresh.
 */
export async function voidTxn(txnId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_txn', {
    p_txn_id: txnId,
    p_reason: reason.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/**
 * Correct an entry in one step.
 *
 * Not an overwrite: the corrected version is written and the original is
 * withdrawn together, linked, so history keeps both. One action for the person
 * fixing a typo, no gap in the record afterwards.
 */
export async function amendTxn(
  txnId: string,
  lines: {
    item_id: string
    qty: number
    condition?: string | null
    from_loose?: boolean
  }[],
  reason: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('amend_txn', {
    p_txn_id: txnId,
    p_lines: lines,
    p_reason: reason.trim() || null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, emp_code, full_name, phone, role, active')
    .order('full_name')

  if (error) throw error
  return (data ?? []) as Profile[]
}
