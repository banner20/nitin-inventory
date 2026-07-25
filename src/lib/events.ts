import { supabase } from './supabase'
import type { EventRecord, OpenBalance } from './types'

const EVENT_COLS = 'id, name, client, venue, starts_at, ends_at, status, notes'

/** Events worth loading a van for: planned or currently out. */
export async function fetchActiveEvents(): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLS)
    .in('status', ['planned', 'out'])
    .order('starts_at')

  if (error) throw error
  return (data ?? []) as EventRecord[]
}

export async function fetchAllEvents(): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLS)
    .order('starts_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as EventRecord[]
}

export interface NewEventInput {
  name: string
  client?: string
  venue?: string
  startsAt: string
  endsAt: string
  notes?: string
}

export async function createEvent(input: NewEventInput): Promise<EventRecord> {
  const { data: session } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('events')
    .insert({
      name: input.name.trim(),
      client: input.client?.trim() || null,
      venue: input.venue?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      notes: input.notes?.trim() || null,
      created_by: session.user?.id ?? null,
    })
    .select(EVENT_COLS)
    .single()

  if (error) throw new Error(error.message)
  return data as EventRecord
}

export async function setEventStatus(
  id: string,
  status: EventRecord['status'],
): Promise<void> {
  const { error } = await supabase.from('events').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** What this person still holds for one event — the return screen's input. */
export async function fetchOpenBalances(
  personId: string,
  eventId: string,
): Promise<OpenBalance[]> {
  const { data, error } = await supabase
    .from('v_open_balances')
    .select('*')
    .eq('person_id', personId)
    .eq('event_id', eventId)
    .order('item_name')

  if (error) throw error
  return (data ?? []) as OpenBalance[]
}
