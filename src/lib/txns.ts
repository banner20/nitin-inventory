import { supabase } from './supabase'
import type {
  Category,
  Item,
  ItemAvailability,
  ItemKind,
  LineCondition,
  TxnSource,
  TxnType,
} from './types'

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

// ---------------------------------------------------------------------------
// Conflict queue: duplicate items
// ---------------------------------------------------------------------------

export interface DuplicateCandidate {
  item_a_id: string
  item_a_name: string
  item_b_id: string
  item_b_name: string
  similarity: number
}

export async function fetchDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase
    .from('v_item_duplicate_candidates')
    .select('*')
    .order('similarity', { ascending: false })

  if (error) throw error
  return (data ?? []) as DuplicateCandidate[]
}

/**
 * Folds `removeId` into `keepId`: every transaction, kit and recipe line that
 * referenced the removed item now points at the kept one, its name becomes a
 * searchable alias on the survivor, and it is deactivated rather than
 * deleted, so history stays readable.
 */
export async function mergeItems(keepId: string, removeId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_items', {
    p_keep_id: keepId,
    p_remove_id: removeId,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Import from a spreadsheet
// ---------------------------------------------------------------------------

export interface ImportRow {
  name: string
  category?: string
  kind?: string
  unit?: string
  pack_size?: string
  pack_label?: string
  sku?: string
  min_stock?: string
  aliases?: string
}

export interface ImportPlanLine {
  row: ImportRow
  action: 'create' | 'update'
  existingId?: string
  errors: string[]
}

/** Decide, without writing anything, what each row will do — so the admin
 * approves a plan instead of an opaque bulk write. */
export function planImport(
  rows: ImportRow[],
  existingItems: ItemAvailability[],
): ImportPlanLine[] {
  const byName = new Map(existingItems.map((i) => [i.name.trim().toLowerCase(), i]))

  return rows.map((row) => {
    const errors: string[] = []
    const name = row.name?.trim()
    if (!name) errors.push('Missing a name')

    const packSize = row.pack_size?.trim()
    if (packSize && (Number.isNaN(Number(packSize)) || Number(packSize) <= 0)) {
      errors.push('Pack size must be a positive number')
    }

    const minStock = row.min_stock?.trim()
    if (minStock && Number.isNaN(Number(minStock))) {
      errors.push('Minimum stock must be a number')
    }

    const kind = row.kind?.trim().toLowerCase()
    if (kind && kind !== 'returnable' && kind !== 'consumable') {
      errors.push('Kind must be "returnable" or "consumable"')
    }

    const existing = name ? byName.get(name.toLowerCase()) : undefined
    return {
      row,
      action: existing ? 'update' : 'create',
      existingId: existing?.item_id,
      errors,
    }
  })
}

export interface ImportSummary {
  created: number
  updated: number
  categoriesCreated: number
  skipped: number
}

/** Run at limited concurrency so a few hundred rows don't fire a few hundred
 * simultaneous requests at Supabase. */
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++]!
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export async function runImport(
  plan: ImportPlanLine[],
  categories: Category[],
): Promise<ImportSummary> {
  const validLines = plan.filter((l) => l.errors.length === 0 && l.row.name.trim())
  const skipped = plan.length - validLines.length

  // Categories named in the sheet that don't exist yet get created up front,
  // so every row below can resolve a category_id.
  const catMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
  const wanted = new Set(
    validLines
      .map((l) => l.row.category?.trim())
      .filter((c): c is string => !!c && !catMap.has(c.toLowerCase())),
  )
  let categoriesCreated = 0
  if (wanted.size > 0) {
    const { data, error } = await supabase
      .from('categories')
      .insert([...wanted].map((name) => ({ name })))
      .select('id, name')
    if (!error && data) {
      for (const c of data) catMap.set(c.name.trim().toLowerCase(), c.id)
      categoriesCreated = data.length
    }
    // A race with another admin creating the same category shows up as a
    // conflict here — re-read so the row still resolves instead of failing.
    if (error) {
      const { data: refreshed } = await supabase.from('categories').select('id, name')
      for (const c of refreshed ?? []) catMap.set(c.name.trim().toLowerCase(), c.id)
    }
  }

  function toPayload(line: ImportPlanLine) {
    const r = line.row
    const kindRaw = r.kind?.trim().toLowerCase()
    const kind: ItemKind = kindRaw === 'returnable' ? 'returnable' : 'consumable'
    const packSize = Number(r.pack_size) > 0 ? Number(r.pack_size) : 1
    return {
      name: r.name.trim(),
      category_id: r.category?.trim() ? (catMap.get(r.category.trim().toLowerCase()) ?? null) : null,
      unit: r.unit?.trim() || 'pcs',
      sku: r.sku?.trim() || null,
      min_stock: Number(r.min_stock) || 0,
      aliases: r.aliases
        ? r.aliases.split(/[;|]/).map((a) => a.trim()).filter(Boolean)
        : [],
      kind,
      pack_size: packSize,
      pack_label: r.pack_label?.trim() || null,
    }
  }

  const toCreate = validLines.filter((l) => l.action === 'create').map(toPayload)
  const toUpdate = validLines.filter((l) => l.action === 'update')

  let created = 0
  if (toCreate.length > 0) {
    const { data, error } = await supabase.from('items').insert(toCreate).select('id')
    if (error) throw new Error(error.message)
    created = data?.length ?? 0
  }

  let updated = 0
  await withConcurrency(toUpdate, 5, async (line) => {
    const { error } = await supabase
      .from('items')
      .update(toPayload(line))
      .eq('id', line.existingId!)
    if (!error) updated++
  })

  return { created, updated, categoriesCreated, skipped }
}
