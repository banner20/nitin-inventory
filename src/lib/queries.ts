import { supabase } from './supabase'
import type { ItemAvailability, OpenBalance, Profile, TxnHistoryEntry, TxnType } from './types'

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

/**
 * Every stock action with who did it, newest first. Paged rather than
 * loaded in full — a busy bar generates a transaction every few minutes
 * during service, and this history only grows.
 */
export async function fetchTxnHistory(
  offset: number,
  limit: number,
  type?: TxnType,
): Promise<TxnHistoryEntry[]> {
  let query = supabase
    .from('v_txn_history')
    .select('*')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TxnHistoryEntry[]
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, emp_code, full_name, phone, role, active')
    .order('full_name')

  if (error) throw error
  return (data ?? []) as Profile[]
}
