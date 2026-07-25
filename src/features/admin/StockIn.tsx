import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { postTxn, type PostLine } from '@/lib/txns'
import { itemMatches, type ItemAvailability } from '@/lib/types'

interface DraftRow {
  item: ItemAvailability
  qty: number
  unitCost: string
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
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ count: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chosen = new Set(rows.map((r) => r.item.item_id))

  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? [])
      .filter((i) => itemMatches(i, q) && !chosen.has(i.item_id))
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, rows])

  const totalValue = rows.reduce(
    (sum, r) => sum + (Number(r.unitCost) || 0) * r.qty,
    0,
  )

  function add(item: ItemAvailability) {
    setRows((r) => [...r, { item, qty: 1, unitCost: '' }])
    setQ('')
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
      const lines: PostLine[] = rows.map((r) => ({
        item_id: r.item.item_id,
        qty: r.qty,
        unit_cost: r.unitCost === '' ? null : Number(r.unitCost),
        vendor: vendor.trim() || null,
      }))
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
          {q && matches.length === 0 && (
            <p className="text-sm text-ink-400">
              Nothing matches.{' '}
              <Link to="/admin" className="text-brand-400 underline">
                Add it to the master sheet
              </Link>{' '}
              first.
            </p>
          )}
          {matches.length > 0 && (
            <ul className="card divide-y divide-ink-800">
              {matches.map((m) => (
                <li key={m.item_id}>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-ink-850 flex justify-between gap-3"
                    onClick={() => add(m)}
                  >
                    <span className="text-ink-200">{m.name}</span>
                    <span className="text-xs text-ink-600 shrink-0">
                      {m.qty_owned} owned
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-400 border-b border-ink-800">
              <tr>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium w-28">Quantity</th>
                <th className="p-3 font-medium w-36">Cost each (₹)</th>
                <th className="p-3 font-medium text-right w-28">Line total</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((r) => (
                <tr key={r.item.item_id}>
                  <td className="p-3">
                    <span className="text-white">{r.item.name}</span>
                    <span className="text-ink-600"> · {r.item.unit}</span>
                  </td>
                  <td className="p-2">
                    <input
                      className="input tabular h-10 min-h-10"
                      type="number"
                      min={1}
                      value={r.qty}
                      onChange={(e) =>
                        update(r.item.item_id, { qty: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="input tabular h-10 min-h-10"
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.unitCost}
                      onChange={(e) => update(r.item.item_id, { unitCost: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                  <td className="p-3 text-right tabular text-ink-400">
                    {r.unitCost
                      ? `₹${((Number(r.unitCost) || 0) * r.qty).toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      className="text-ink-600 hover:text-bad-500 px-2"
                      onClick={() => remove(r.item.item_id)}
                      aria-label={`Remove ${r.item.name}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
