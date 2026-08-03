import { useMemo, useState } from 'react'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { fetchCategories } from '@/lib/txns'
import {
  formatPacks,
  formatQty,
  itemMatches,
  type ItemAvailability,
} from '@/lib/types'
import ImportItems from './ImportItems'
import ItemForm from './ItemForm'

type SortKey = 'name' | 'qty_available' | 'qty_out' | 'qty_owned'

export default function MasterSheet() {
  const items = useAsync(fetchItemAvailability, [])
  const cats = useAsync(fetchCategories, [])
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [onlyMismatch, setOnlyMismatch] = useState(false)
  const [sort, setSort] = useState<SortKey>('name')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<ItemAvailability | null>(null)

  const rows = useMemo(() => {
    let list = items.data ?? []
    if (q.trim()) list = list.filter((i) => itemMatches(i, q))
    if (categoryId) list = list.filter((i) => i.category_id === categoryId)
    if (onlyLow) list = list.filter((i) => i.below_min)
    if (onlyMismatch) list = list.filter((i) => Number(i.qty_available) < 0)
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : Number(b[sort]) - Number(a[sort]),
    )
  }, [items.data, q, categoryId, onlyLow, onlyMismatch, sort])

  const totals = useMemo(() => {
    const list = items.data ?? []
    return {
      items: list.length,
      out: list.filter((i) => Number(i.qty_out) > 0).length,
      low: list.filter((i) => i.below_min).length,
      // Available below zero means more has gone out than was ever recorded
      // coming in — the books don't add up and a human has to look. Fixed
      // in the conflict queue, or by adding the missing stock-in here.
      mismatch: list.filter((i) => Number(i.qty_available) < 0).length,
    }
  }, [items.data])

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Master sheet</h1>
          <p className="text-sm text-ink-400">
            {totals.items} items · {totals.out} currently out
            {totals.low > 0 && (
              <span className="text-warn-500"> · {totals.low} below minimum</span>
            )}
            {totals.mismatch > 0 && (
              <span className="text-bad-500">
                {' '}
                · {totals.mismatch} don't add up
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setImporting((i) => !i)}>
            {importing ? 'Cancel' : 'Import'}
          </button>
          <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : 'Add item'}
          </button>
        </div>
      </header>

      {importing && (
        <ImportItems
          categories={cats.data ?? []}
          existingItems={items.data ?? []}
          onImported={() => {
            items.reload()
            cats.reload()
          }}
          onClose={() => setImporting(false)}
        />
      )}

      {adding && (
        <ItemForm
          categories={cats.data ?? []}
          onCreated={() => {
            setAdding(false)
            items.reload()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {editing && (
        <ItemForm
          categories={cats.data ?? []}
          editItem={editing}
          onCreated={() => {
            setEditing(null)
            items.reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="input w-auto flex-1 min-w-56"
          placeholder="Search items…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-auto"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="name">Sort by name</option>
          <option value="qty_available">Most available</option>
          <option value="qty_out">Most out</option>
          <option value="qty_owned">Most owned</option>
        </select>
        <label className="flex items-center gap-2 px-3 text-sm text-ink-400">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Below minimum
        </label>
        {totals.mismatch > 0 && (
          <label className="flex items-center gap-2 px-3 text-sm text-bad-500">
            <input
              type="checkbox"
              checked={onlyMismatch}
              onChange={(e) => setOnlyMismatch(e.target.checked)}
            />
            Doesn't add up
          </label>
        )}
      </div>

      {items.loading && <p className="text-sm text-ink-400">Loading…</p>}
      {items.error && <p className="text-sm text-bad-500">{items.error.message}</p>}

      {!items.loading && rows.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-400">
          {q || categoryId || onlyLow
            ? 'Nothing matches those filters.'
            : 'No items yet. Add your first one above.'}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-400 border-b border-ink-800">
              <tr>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium text-right">Owned</th>
                <th className="p-3 font-medium text-right">Out</th>
                <th className="p-3 font-medium text-right">Quarantine</th>
                <th className="p-3 font-medium text-right">Available</th>
                <th className="p-3 font-medium text-right">Min</th>
                <th className="p-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {rows.map((r) => (
                <Row key={r.item_id} row={r} onEdit={() => setEditing(r)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Amber inside 60 days, red once it's passed — same visual language as the
 * "doesn't add up" flag elsewhere on this sheet. */
function expiryStatus(dateStr: string): 'expired' | 'soon' | null {
  const days = (new Date(dateStr).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'expired'
  if (days <= 60) return 'soon'
  return null
}

function Row({ row, onEdit }: { row: ItemAvailability; onEdit: () => void }) {
  const status = row.expiry_date ? expiryStatus(row.expiry_date) : null

  return (
    <tr className="hover:bg-ink-850">
      <td className="p-3">
        <span className="text-white">{row.name}</span>
        {row.kind === 'consumable' ? (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-600">
            consumable
          </span>
        ) : (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-400/70">
            returnable
          </span>
        )}
        <span className="block text-xs text-ink-600">
          {row.pack_label ? `${row.pack_size} ${row.unit} per ${row.pack_label}` : row.unit}
          {row.alt_packs && row.alt_packs.length > 0 && (
            <> · also {row.alt_packs.map((p) => `${p.pack_size} ${row.unit} per ${p.pack_label}`).join(', ')}</>
          )}
        </span>
        {(row.last_vendor || row.last_unit_cost != null) && (
          <span className="block text-xs text-ink-600">
            {row.last_vendor}
            {row.last_vendor && row.last_unit_cost != null && ' · '}
            {row.last_unit_cost != null && `₹${row.last_unit_cost.toLocaleString('en-IN')}/${row.unit}`}
          </span>
        )}
        {status && (
          <span
            className={`block text-xs ${status === 'expired' ? 'text-bad-500' : 'text-warn-500'}`}
          >
            {status === 'expired' ? 'Expired' : 'Expires'}{' '}
            {new Date(row.expiry_date!).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </td>
      <td className="p-3 text-right tabular text-ink-400">
        {Number(row.qty_owned) ? formatPacks(row.qty_owned, row) : ''}
      </td>
      <td className="p-3 text-right tabular text-ink-400">
        {Number(row.qty_out) ? formatPacks(row.qty_out, row) : ''}
      </td>
      <td className="p-3 text-right tabular">
        {Number(row.qty_quarantined) ? (
          <span className="text-warn-500">{formatPacks(row.qty_quarantined, row)}</span>
        ) : (
          ''
        )}
      </td>
      <td className="p-3 text-right tabular font-semibold">
        <span
          className={
            Number(row.qty_available) < 0
              ? 'text-bad-500'
              : row.below_min
                ? 'text-warn-500'
                : 'text-white'
          }
          title={
            Number(row.qty_available) < 0
              ? "Doesn't add up: more has gone out than was ever recorded as bought or received. Fix it under Conflicts, or add the missing stock-in here."
              : formatQty(row.qty_available, row)
          }
        >
          {formatQty(row.qty_available, row)}
        </span>
        {Number(row.qty_available) < 0 && (
          <span className="block text-[10px] uppercase tracking-wide text-bad-500/80">
            doesn't add up
          </span>
        )}
        {Number(row.qty_loose) > 0 && (
          <span className="block text-[10px] font-normal text-ink-500">
            incl. {formatPacks(row.qty_loose, row)} loose
          </span>
        )}
      </td>
      <td className="p-3 text-right tabular text-ink-600">
        {Number(row.min_stock) ? formatPacks(row.min_stock, row) : ''}
      </td>
      <td className="p-3 text-right">
        <button className="btn btn-ghost h-8 min-h-8 text-xs px-2.5" onClick={onEdit}>
          Edit
        </button>
      </td>
    </tr>
  )
}

