import { supabase } from './supabase'
import type { Category, Item, LineCondition, TxnSource, TxnType } from './types'

export interface PostLine {
  item_id: string
  qty: number
  condition?: LineCondition
  from_quarantine?: boolean
  unit_cost?: number | null
  vendor?: string | null
  note?: string | null
}

export interface PostTxnInput {
  type: TxnType
  lines: PostLine[]
  eventId?: string | null
  personId?: string | null
  note?: string | null
  source?: TxnSource
  occurredAt?: string | null
  /**
   * Generated on the device before the request leaves. Passing the same value
   * twice returns the original transaction instead of posting a second one,
   * which is what makes a retry over a bad connection safe.
   */
  clientUuid?: string
}

export async function postTxn(input: PostTxnInput): Promise<string> {
  const { data, error } = await supabase.rpc('post_txn', {
    p_client_uuid: input.clientUuid ?? crypto.randomUUID(),
    p_type: input.type,
    p_lines: input.lines,
    p_event_id: input.eventId ?? null,
    p_person_id: input.personId ?? null,
    p_note: input.note ?? null,
    p_source: input.source ?? 'manual',
    p_occurred_at: input.occurredAt ?? null,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort')
    .order('sort')

  if (error) throw error
  return (data ?? []) as Category[]
}

export interface NewItemInput {
  name: string
  categoryId: string | null
  unit: string
  sku?: string | null
  minStock: number
  aliases: string[]
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      name: input.name.trim(),
      category_id: input.categoryId,
      unit: input.unit.trim() || 'pcs',
      sku: input.sku?.trim() || null,
      min_stock: input.minStock,
      aliases: input.aliases,
    })
    .select('id, name, category_id, unit, sku, min_stock, aliases, photo_url, notes, active')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('An item with that name already exists.')
    }
    throw new Error(error.message)
  }
  return data as Item
}

export async function updateItem(id: string, patch: Partial<NewItemInput>): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.categoryId !== undefined) body.category_id = patch.categoryId
  if (patch.unit !== undefined) body.unit = patch.unit.trim() || 'pcs'
  if (patch.sku !== undefined) body.sku = patch.sku?.trim() || null
  if (patch.minStock !== undefined) body.min_stock = patch.minStock
  if (patch.aliases !== undefined) body.aliases = patch.aliases

  const { error } = await supabase.from('items').update(body).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Fuzzy match so we can warn before someone creates a near-duplicate. */
export async function findSimilarItems(name: string): Promise<{ id: string; name: string }[]> {
  if (name.trim().length < 3) return []
  const { data, error } = await supabase.rpc('find_similar_items', { p_name: name.trim() })
  if (error) return []
  return (data ?? []) as { id: string; name: string }[]
}
