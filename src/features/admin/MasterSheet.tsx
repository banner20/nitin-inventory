import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { fetchCategories } from '@/lib/txns'
import {
  formatMoney,
  formatQty,
  formatUnitPrice,
  itemMatches,
  type ItemAvailability,
} from '@/lib/types'
import { EmptyState, ErrorText, Loading, PageHeader, Stat } from '@/components/ui'
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
      // Only what's actually on the shelf, and only what we have a price
      // for — the count of unpriced items is shown alongside so the figure
      // is never mistaken for the whole picture.
      value: list.reduce((sum, i) => sum + Number(i.stock_value ?? 0), 0),
      unpriced: list.filter((i) => i.unit_cost == null).length,
    }
  }, [items.data])

  const filtered = !!(q || categoryId || onlyLow || onlyMismatch)

  return (
    <div className="space-y-5 max-w-7xl">
      <PageHeader
        title="Master sheet"
        description="Everything the company owns, and where it currently is."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setImporting((i) => !i)}>
              {importing ? 'Cancel' : 'Import'}
            </button>
            {/* Adding a thing and stocking it are one action now, and it
                lives on one screen. */}
            <Link to="/admin/stock-in" className="btn btn-primary">
              Add stock
            </Link>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Stat
          label={
            totals.unpriced > 0 ? `Stock value · ${totals.unpriced} unpriced` : 'Stock value'
          }
          value={formatMoney(totals.value)}
        />
        <Stat label="Items tracked" value={totals.items} />
        <Stat label="Currently out" value={totals.out} />
        <Stat
          label="Below minimum"
          value={totals.low}
          tone={totals.low > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Don't add up"
          value={totals.mismatch}
          tone={totals.mismatch > 0 ? 'bad' : 'neutral'}
        />
      </div>

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-auto flex-1 min-w-56"
          placeholder="Search items, aliases or SKU…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-auto"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
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
          aria-label="Sort"
        >
          <option value="name">Sort by name</option>
          <option value="qty_available">Most available</option>
          <option value="qty_out">Most out</option>
          <option value="qty_owned">Most owned</option>
        </select>

        <FilterToggle
          active={onlyLow}
          onClick={() => setOnlyLow((v) => !v)}
          tone="warn"
          count={totals.low}
        >
          Below minimum
        </FilterToggle>

        {totals.mismatch > 0 && (
          <FilterToggle
            active={onlyMismatch}
            onClick={() => setOnlyMismatch((v) => !v)}
            tone="bad"
            count={totals.mismatch}
          >
            Doesn't add up
          </FilterToggle>
        )}
      </div>

      {items.loading && <Loading />}
      {items.error && <ErrorText>{items.error.message}</ErrorText>}

      {!items.loading && rows.length === 0 && (
        <EmptyState
          title={filtered ? 'Nothing matches those filters' : 'No items yet'}
          hint={
            filtered
              ? 'Try clearing the search or category filter.'
              : 'Add your first item, or import a spreadsheet to load the whole catalogue at once.'
          }
        />
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/*
                Available splits into two columns rather than one cell
                carrying "2 bottles + 250 ml, incl. 250 ml loose". Sealed packs
                and an opened bottle are different things to a person standing
                at a shelf — one you can hand over whole, one you can't — so
                they get a column each under a shared heading.
              */}
              <thead className="bg-surface-alt border-b border-line">
                <tr className="text-left">
                  <th className="th" rowSpan={2}>
                    Item
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    Owned
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    Out
                  </th>
                  {/* No Damaged column: it's empty on almost every row, and a
                      column that's always "—" costs width on every screen to
                      report nothing. Breakage still shows — as a badge on the
                      item itself — so the rare row where it matters can't go
                      unnoticed, and Available still has a visible reason for
                      being lower than Owned minus Out. */}
                  <th className="th text-center border-x border-line pb-0" colSpan={2}>
                    Available
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    Min
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    Price
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    Value
                  </th>
                  <th className="th text-right" rowSpan={2}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
                <tr className="text-left">
                  <th
                    className="th text-right pt-0 border-l border-line font-normal normal-case tracking-normal"
                    title="Sealed, unopened packs — what you can hand over whole."
                  >
                    Full
                  </th>
                  <th
                    className="th text-right pt-0 border-r border-line font-normal normal-case tracking-normal"
                    title="Opened bottles with some left in them."
                  >
                    Loose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <Row key={r.item_id} row={r} onEdit={() => setEditing(r)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-line bg-surface-alt text-xs text-fg-subtle tabular">
            Showing {rows.length} of {totals.items} items
          </div>
        </div>
      )}
    </div>
  )
}

/** A filter that shows its own hit count, so you can tell whether turning it
 * on is worth the click before you click it. */
function FilterToggle({
  active,
  onClick,
  tone,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  tone: 'warn' | 'bad'
  count: number
  children: ReactNode
}) {
  const activeClass =
    tone === 'bad'
      ? 'bg-bad-50 border-bad-200 text-bad-700'
      : 'bg-warn-50 border-warn-200 text-warn-700'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border text-sm font-medium transition-colors ' +
        (active
          ? activeClass
          : 'bg-surface border-line-strong text-fg-muted hover:bg-surface-hover')
      }
    >
      {children}
      <span className="tabular text-xs opacity-70">{count}</span>
    </button>
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
  const short = Number(row.qty_available) < 0
  const pricedAltPacks = (row.alt_packs ?? []).filter((p) => p.unit_cost != null)
  // Loose is a subset of available, not extra on top, so sealed is what's
  // left once the opened bottles are set aside.
  const loose = Number(row.qty_loose)
  const sealed = Number(row.qty_available) - loose
  const damaged = Number(row.qty_quarantined)

  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{row.name}</span>
          <span
            className={
              'badge ' + (row.kind === 'consumable' ? 'badge-neutral' : 'badge-brand')
            }
          >
            {row.kind}
          </span>
          {status && (
            <span className={'badge ' + (status === 'expired' ? 'badge-bad' : 'badge-warn')}>
              {status === 'expired' ? 'Expired' : 'Expires'}{' '}
              {new Date(row.expiry_date!).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
          {damaged > 0 && (
            <span
              className="badge badge-warn"
              title="Came back broken — held back until it's repaired or written off, and not counted as available."
            >
              {formatQty(damaged, row)} damaged
            </span>
          )}
        </div>
        <span className="block text-xs text-fg-subtle mt-0.5">
          {row.pack_label ? `${row.pack_size} ${row.unit} per ${row.pack_label}` : row.unit}
          {row.alt_packs && row.alt_packs.length > 0 && (
            <>
              {' · also '}
              {row.alt_packs
                .map((p) => `${p.pack_size} ${row.unit} per ${p.pack_label}`)
                .join(', ')}
            </>
          )}
          {(row.last_vendor || row.last_unit_cost != null) && (
            <>
              {' · '}
              {row.last_vendor}
              {row.last_vendor && row.last_unit_cost != null && ' · '}
              {row.last_unit_cost != null &&
                `₹${row.last_unit_cost.toLocaleString('en-IN')}/${row.unit}`}
            </>
          )}
        </span>
      </td>

      {/* Every quantity column reads the same way — whole packs plus the
          remainder, never "2.357 monins". */}
      <td className="px-3 py-2.5 text-right tabular text-fg-muted whitespace-nowrap">
        {Number(row.qty_owned) ? formatQty(row.qty_owned, row) : '—'}
      </td>

      <td className="px-3 py-2.5 text-right tabular text-fg-muted whitespace-nowrap">
        {Number(row.qty_out) ? formatQty(row.qty_out, row) : '—'}
      </td>

      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap border-l border-line">
        <span
          className={
            'font-semibold ' +
            (short ? 'text-bad-600' : row.below_min ? 'text-warn-600' : 'text-fg')
          }
          title={
            short
              ? "Doesn't add up: more has gone out than was ever recorded as bought or received. Fix it under Conflicts, or add the missing stock-in here."
              : `${formatQty(sealed, row)} sealed of ${formatQty(row.qty_available, row)} available`
          }
        >
          {sealed === 0 ? (
            <span className="text-fg-subtle font-normal">
              {loose > 0 ? 'none sealed' : formatQty(0, row)}
            </span>
          ) : (
            formatQty(sealed, row)
          )}
        </span>
        {short && (
          <span className="block mt-1">
            <span className="badge badge-bad">doesn't add up</span>
          </span>
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap border-r border-line">
        {loose > 0 ? (
          /* Loose stock is a part-used bottle, so it reads in the base unit —
             "0.357 bottles" is arithmetically true and useless to anyone
             holding the thing. */
          <span className="text-warn-700" title="Opened — not a full pack">
            {formatQty(loose, row)}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular text-fg-subtle whitespace-nowrap">
        {Number(row.min_stock) ? formatQty(row.min_stock, row) : "—"}
      </td>

      <td className="px-3 py-2.5 text-right tabular text-fg-muted whitespace-nowrap">
        {row.unit_cost == null ? (
          <span className="text-fg-subtle" title="No price on file yet">
            —
          </span>
        ) : (
          <>
            {formatUnitPrice(row.unit_cost, row)}
            {/* Each size has its own price, so an item bought as both
                bottles and a bulk jug has two. The main one is shown; the
                rest are a hover away rather than crowding the column. */}
            {pricedAltPacks.length > 0 && (
              <span
                className="block text-[11px] text-fg-subtle"
                title={pricedAltPacks
                  .map((p) => `${formatMoney(p.unit_cost! * p.pack_size)} per ${p.pack_label}`)
                  .join('\n')}
              >
                +{pricedAltPacks.length} other size
                {pricedAltPacks.length === 1 ? '' : 's'}
              </span>
            )}
          </>
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {row.stock_value == null ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <span className="font-medium">{formatMoney(row.stock_value)}</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-right">
        <button className="btn btn-ghost h-8 min-h-8 text-xs px-2.5" onClick={onEdit}>
          Edit
        </button>
      </td>
    </tr>
  )
}
