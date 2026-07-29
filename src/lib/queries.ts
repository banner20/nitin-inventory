import { supabase } from './supabase'
import type { ItemAvailability, OpenBalance, Profile } from './types'

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

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, emp_code, full_name, phone, role, active')
    .order('full_name')

  if (error) throw error
  return (data ?? []) as Profile[]
}
