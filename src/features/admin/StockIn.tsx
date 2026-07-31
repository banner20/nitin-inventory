import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { fetchCategories, postTxn, type PostLine } from '@/lib/txns'
import { formatPacks, itemMatches, toItemAvailability, type ItemAvailability } from '@/lib/types'
import {
  AmountInput,
  amountToBase,
  defaultMode,
  packOptions,
  type AmountMode,
} from '@/components/AmountInput'
import ItemForm from './ItemForm'

interface DraftRow {
  item: ItemAvailability
  amount: string
  mode: AmountMode
  /** Cost of one whatever-unit-is-selected — how invoices are actually written. */
  packCost: string
}

function toBase(row: DraftRow): number {
  return amountToBase(row.amount, row.mode, row.item)
}

function lineTotal(row: DraftRow): number {
  return (Number(row.packCost) || 0) * (Number(row.amount) || 0)
}

/**
 * Recording stock you've received — a delivery from a supplier, or the initial
 * count when you first set the system up.
 *
 * This posts an ADD transaction, which is the only thing that increases what
 * the company owns. It is deliberately the same ledger the crew's check-outs
 * go into, so "what do we own" and "where is it" can never disagree.
 */
export default function StockIn() {
  const items = useAsync(fetchItemAvailability, [])
  const cats = useAsync(fetchCategories, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ count: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set once someone chooses "create it" for a name nothing matched — shows
  // the add-item panel right here instead of sending them away to do it.
  const [creatingName, setCreatingName] = useState<string | null>(null)

  const chosen = new Set(rows.map((r) => r.item.item_id))

  // Arriving from the conflict queue with "this item needs stock" pre-adds
  // it, so fixing a mismatch is one screen instead of a search-and-find.
  useEffect(() => {
    const wanted = searchParams.get('item')
    if (!wanted || !items.data) return
    const found = items.data.find((i) => i.item_id === wanted)
    if (found) addRow(found)
    setSearchParams((p) => {
      p.delete('item')
      return p
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data])

  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? [])
      .filter((i) => itemMatches(i, q) && !chosen.has(i.item_id))
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, rows])

  const totalValue = rows.reduce((sum, r) => sum + lineTotal(r), 0)

  /** Adding an item prefills what it usually costs and who it usually comes
   * from — a hint to edit, not a silent default — so re-ordering the same
   * thing doesn't mean retyping a price you already paid last time. */
  function addRow(item: ItemAvailability) {
    const mode = defaultMode(item)
    const packSize = packOptions(item).find((o) => o.id === mode)?.size ?? 1
    const packCost =
      item.last_unit_cost != null ? String(Number((item.last_unit_cost * packSize).toFixed(2))) : ''

    setRows((r) => [...r, { item, amount: '1', mode, packCost }])
    setQ('')

    if (!vendor.trim() && item.last_vendor) setVendor(item.last_vendor)
  }

  /** A brand-new item created straight from Stock In drops right into the
   * basket — no separate trip to the master sheet to add it first. */
  function onItemCreated(item: Parameters<typeof toItemAvailability>[0]) {
    const withStock = toItemAvailability(item, cats.data ?? [])
    setRows((r) => [...r, { item: withStock, amount: '1', mode: defaultMode(withStock), packCost: '' }])
    setCreatingName(null)
    setQ('')
    items.reload()
  }

  function update(id: string, patch: Partial<DraftRow>) {
    setRows((r) => r.map((row) => (row.item.item_id === id ? { ...row, ...patch } : row)))
  }

  function remove(id: string) {
    setRows((r) => r.filter((row) => row.item.item_id !== id))
  }

  async function post() {
    setBusy(true)
    setError(null)
    try {
      const lines: PostLine[] = rows.map((r) => {
        const qty = toBase(r)
        // Store cost per base unit so line value stays qty * unit_cost no
        // matter which unit it was typed in.
        const perBase = r.packCost === '' || qty === 0 ? null : lineTotal(r) / qty
        return {
          item_id: r.item.item_id,
          qty,
          unit_cost: perBase,
          vendor: vendor.trim() || null,
        }
      })
      await postTxn({ type: 'ADD', lines, note })
      setDone({ count: rows.length, total: totalValue })
      setRows([])
      setVendor('')
      setNote('')
      items.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <header>
        <h1 className="text-xl font-semibold text-white">Stock in</h1>
        <p className="text-sm text-ink-400">
          Record gear you’ve bought or received. This is what increases the
          quantity you own — everything else only moves it around.
        </p>
      </header>

      {done && (
        <div className="rounded-lg border border-good-500/40 bg-good-500/10 p-3 text-sm">
          <p className="text-good-500 font-medium">
            Added {done.count} item{done.count === 1 ? '' : 's'}
            {done.total > 0 && ` · ₹${done.total.toLocaleString('en-IN')}`}
          </p>
          <Link to="/admin" className="text-brand-400 underline">
            See it on the master sheet
          </Link>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm text-ink-400">Supplier (optional)</span>
            <input
              className="input"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Sound Sales India"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm text-ink-400">Note (optional)</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Invoice 4471 / opening count"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm text-ink-400">Add items</span>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the master sheet…"
          />
          {q.trim() && matches.length === 0 && !creatingName && (
            <p className="text-sm text-ink-400">
              Nothing matches “{q.trim()}”.{' '}
              <button
                type="button"
                className="text-brand-400 underline"
                onClick={() => setCreatingName(q.trim())}
              >
                Add it as a new item
              </button>
            </p>
          )}
          {matches.length > 0 && (
            <ul className="card divide-y divide-ink-800">
              {matches.map((m) => (
                <li key={m.item_id}>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-ink-850 flex justify-between gap-3"
                    onClick={() => addRow(m)}
                  >
                    <span className="text-ink-200">{m.name}</span>
                    <span className="text-xs text-ink-600 shrink-0">
                      {formatPacks(m.qty_owned, m)} owned
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {creatingName && (
          <ItemForm
            categories={cats.data ?? []}
            initialName={creatingName}
            submitLabel="Add and load"
            onCreated={onItemCreated}
            onCancel={() => setCreatingName(null)}
          />
        )}
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.item.item_id} className="card p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white truncate">{r.item.name}</p>
                  {r.item.last_vendor && (
                    <p className="text-xs text-ink-600">
                      Last from {r.item.last_vendor}
                      {r.item.last_unit_cost != null &&
                        ` · ₹${r.item.last_unit_cost.toLocaleString('en-IN')}/${r.item.unit}`}
                    </p>
                  )}
                </div>
                <button
                  className="text-ink-600 hover:text-bad-500 px-2"
                  onClick={() => remove(r.item.item_id)}
                  aria-label={`Remove ${r.item.name}`}
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <AmountInput
                  item={r.item}
                  amount={r.amount}
                  mode={r.mode}
                  ariaLabel={`Quantity of ${r.item.name}`}
                  onChange={(amount, mode) => update(r.item.item_id, { amount, mode })}
                />

                <label className="space-y-1.5">
                  <span className="text-xs text-ink-400">Cost each</span>
                  <input
                    className="input tabular h-11 min-h-11 w-32"
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.packCost}
                    onChange={(e) => update(r.item.item_id, { packCost: e.target.value })}
                    placeholder="₹"
                  />
                </label>

                <p className="text-sm text-ink-400 pb-2.5">
                  {r.packCost ? `= ₹${lineTotal(r).toLocaleString('en-IN')}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-bad-500">{error}</p>}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <p className="text-sm text-ink-400">
            {rows.length} line{rows.length === 1 ? '' : 's'}
            {totalValue > 0 && (
              <>
                {' · '}
                <span className="text-white tabular">
                  ₹{totalValue.toLocaleString('en-IN')}
                </span>
              </>
            )}
          </p>
          <button className="btn btn-primary" onClick={() => void post()} disabled={busy}>
            {busy ? 'Saving…' : 'Add to inventory'}
          </button>
        </div>
      )}
    </div>
  )
}
