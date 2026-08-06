import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { useIdempotencyKey } from '@/lib/useIdempotencyKey'
import { fetchItemAvailability } from '@/lib/queries'
import { fetchCategories, postTxn, type PostLine } from '@/lib/txns'
import {
  formatMoney,
  formatQty,
  itemMatches,
  toItemAvailability,
  type ItemAvailability,
} from '@/lib/types'
import {
  AmountInput,
  amountToBase,
  defaultMode,
  packOptions,
  type AmountMode,
} from '@/components/AmountInput'
import { EmptyState, ErrorText, PageHeader } from '@/components/ui'
import ItemForm from './ItemForm'

interface DraftRow {
  /** Identifies the row, not the item — one delivery can hold the same syrup
   * as 250ml bottles and 500ml bottles, at different prices, and those are
   * two rows rather than one. */
  key: string
  item: ItemAvailability
  amount: string
  mode: AmountMode
  /** Cost of one whatever-unit-is-selected — how invoices are actually written. */
  packCost: string
  /** True for a row whose item was created here and now, so the summary can
   * say how many things are new rather than just how many lines there are. */
  isNew?: boolean
}

let rowSeq = 0
function nextKey(): string {
  return `row-${++rowSeq}`
}

function toBase(row: DraftRow): number {
  return amountToBase(row.amount, row.mode, row.item)
}

function lineTotal(row: DraftRow): number {
  return (Number(row.packCost) || 0) * (Number(row.amount) || 0)
}

/** The price already on file for one pack of whichever size is selected.
 * Each size keeps its own, because bulk is cheaper per unit. */
function priceFor(item: ItemAvailability, mode: AmountMode): string {
  const alt = (item.alt_packs ?? []).find((p) => p.id === mode)
  if (alt) {
    return alt.unit_cost == null
      ? ''
      : String(Number((alt.unit_cost * Number(alt.pack_size)).toFixed(2)))
  }
  const size = packOptions(item).find((o) => o.id === mode)?.size ?? 1
  const price = item.unit_cost ?? item.last_unit_cost
  return price == null ? '' : String(Number((price * size).toFixed(2)))
}

/** Which price a purchase is evidence of: an item_packs id for an
 * alternative size, or the item's own price for its default pack. */
function packIdFor(row: DraftRow): string {
  const alt = (row.item.alt_packs ?? []).find((p) => p.id === row.mode)
  return alt ? alt.id : 'default'
}

/**
 * Everything arriving, in one screen.
 *
 * This used to be two: "Add item" wrote down what a thing *is*, "Stock in"
 * wrote down how many turned up. Which meant recording something you'd just
 * bought for the first time took two screens and a trip between them, and it
 * was never obvious which one you wanted. They're one action in the real
 * world — something arrived — so they're one screen here. Type a name; if the
 * system knows it you enter a quantity, and if it doesn't you fill in what it
 * is first. Either way it lands in the same basket.
 *
 * This posts an ADD transaction, which is the only thing that increases what
 * the company owns. It's deliberately the same ledger the crew's check-outs
 * go into, so "what do we own" and "where is it" can never disagree.
 */
export default function StockIn() {
  const items = useAsync(fetchItemAvailability, [])
  const cats = useAsync(fetchCategories, [])
  const idem = useIdempotencyKey()
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ count: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set once someone chooses "create it" for a name nothing matched — shows
  // the new-item panel right here instead of sending them away to do it.
  const [creatingName, setCreatingName] = useState<string | null>(null)

  /** Which size of which item is already in the basket. Keyed by both,
   * because adding a second size of something already listed is the point. */
  const chosen = new Set(rows.map((r) => `${r.item.item_id}:${r.mode}`))

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

  // "new" in the query string opens straight into defining something — the
  // master sheet's Add stock button uses it when the shelf is empty.
  useEffect(() => {
    if (searchParams.get('new') === null) return
    setCreatingName('')
    setSearchParams((p) => {
      p.delete('new')
      return p
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // An item stays searchable while it's in the basket, so long as it has a
  // size that isn't listed yet — that's how the same syrup gets added as both
  // 250ml and 500ml.
  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? [])
      .filter((i) => {
        if (!itemMatches(i, q)) return false
        const sizes = [...packOptions(i).map((o) => o.id), 'base']
        return sizes.some((s) => !chosen.has(`${i.item_id}:${s}`))
      })
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, rows])

  const totalValue = rows.reduce((sum, r) => sum + lineTotal(r), 0)
  const newCount = rows.filter((r) => r.isNew).length

  /** Adding an item prefills what it usually costs and who it usually comes
   * from — a hint to edit, not a silent default — so re-ordering the same
   * thing doesn't mean retyping a price you already paid last time. */
  function addRow(item: ItemAvailability, preferredMode?: AmountMode) {
    // Land on a size that isn't already in the basket, so clicking an item a
    // second time offers its other size rather than a duplicate of the first.
    const sizes = [...packOptions(item).map((o) => o.id), 'base']
    const mode =
      preferredMode ??
      sizes.find((s) => !chosen.has(`${item.item_id}:${s}`)) ??
      defaultMode(item)

    setRows((r) => [
      ...r,
      { key: nextKey(), item, amount: '1', mode, packCost: priceFor(item, mode) },
    ])
    setQ('')

    if (!vendor.trim() && item.last_vendor) setVendor(item.last_vendor)
  }

  /** Switching size has to switch price with it — a jug and a bottle are
   * different money, and carrying the bottle's price over to the jug is
   * exactly the mistake this is here to prevent. */
  function onAmountChange(row: DraftRow, amount: string, mode: AmountMode) {
    const sizeChanged = mode !== row.mode
    update(row.key, {
      amount,
      mode,
      ...(sizeChanged ? { packCost: priceFor(row.item, mode) } : {}),
    })
  }

  /** A brand-new item defined here drops straight into the basket — that's
   * the whole point of the two screens being one. */
  function onItemCreated(item: Parameters<typeof toItemAvailability>[0]) {
    const withStock = toItemAvailability(item, cats.data ?? [])
    const mode = defaultMode(withStock)
    const packSize = packOptions(withStock).find((o) => o.id === mode)?.size ?? 1
    const packCost =
      item.unit_cost != null ? String(Number((item.unit_cost * packSize).toFixed(2))) : ''

    setRows((r) => [
      ...r,
      { key: nextKey(), item: withStock, amount: '1', mode, packCost, isNew: true },
    ])
    setCreatingName(null)
    setQ('')
    items.reload()
  }

  function update(key: string, patch: Partial<DraftRow>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function remove(key: string) {
    setRows((r) => r.filter((row) => row.key !== key))
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
          pack_id: packIdFor(r),
          vendor: vendor.trim() || null,
        }
      })
      await postTxn({ type: 'ADD', lines, note, clientUuid: idem.current() })
      idem.reset()
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
      <PageHeader
        title="Add stock"
        description="Anything that's arrived — a delivery, or the first count of something new. This is the only thing that increases what you own; everything else just moves it around."
      />

      {done && (
        <div className="rounded-lg border border-good-200 bg-good-50 p-3 text-sm">
          <p className="text-good-700 font-medium">
            Added {done.count} item{done.count === 1 ? '' : 's'}
            {done.total > 0 && ` · ${formatMoney(done.total)}`}
          </p>
          <Link to="/admin" className="text-brand-600 font-medium hover:text-brand-700">
            See it on the master sheet →
          </Link>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Supplier (optional)</span>
            <input
              className="input"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Metro Cash & Carry"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Note (optional)</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Invoice 4471 / opening count"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">What arrived?</span>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Start typing a name…"
          />

          {matches.length > 0 && (
            <ul className="card divide-y divide-line mt-1.5">
              {matches.map((m) => (
                <li key={m.item_id}>
                  <button
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-hover flex justify-between gap-3 items-center"
                    onClick={() => addRow(m)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm">{m.name}</span>
                      <span className="block text-xs text-fg-subtle">
                        {formatQty(m.qty_owned, m)} owned
                      </span>
                    </span>
                    <span className="text-brand-600 text-lg shrink-0">+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* The whole reason this screen exists: a name the system has never
              heard of is a normal thing to be holding, not an error. */}
          {q.trim() && matches.length === 0 && creatingName === null && (
            <div className="rounded-lg border border-line bg-surface-alt p-3 mt-1.5 space-y-2">
              <p className="text-sm text-fg-muted">
                Nothing called “{q.trim()}” yet.
              </p>
              <button
                type="button"
                className="btn btn-primary h-9 min-h-9 text-sm"
                onClick={() => setCreatingName(q.trim())}
              >
                Set it up and add it
              </button>
            </div>
          )}

          {!q.trim() && creatingName === null && rows.length === 0 && (
            <p className="text-xs text-fg-subtle pt-1">
              Not on the list yet? Type its name and you can set it up here.
            </p>
          )}
        </div>

        {creatingName !== null && (
          <ItemForm
            categories={cats.data ?? []}
            initialName={creatingName}
            submitLabel="Set up and add"
            onCreated={onItemCreated}
            onCancel={() => setCreatingName(null)}
          />
        )}
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="card p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    {r.item.name}
                    {r.isNew && <span className="badge badge-good">new</span>}
                    {/* When the same item appears more than once, say which
                        size each row is — otherwise two identical-looking
                        rows are indistinguishable at a glance. */}
                    {rows.filter((x) => x.item.item_id === r.item.item_id).length > 1 && (
                      <span className="badge badge-brand">
                        {packOptions(r.item).find((o) => o.id === r.mode)?.label ?? r.item.unit}
                      </span>
                    )}
                  </p>
                  {r.item.last_vendor && (
                    <p className="text-xs text-fg-subtle">
                      Last from {r.item.last_vendor}
                      {r.item.last_unit_cost != null &&
                        ` · ${formatMoney(r.item.last_unit_cost)}/${r.item.unit}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Adding another size of something already in the basket
                      is the common case for a mixed delivery, so it's a
                      button on the row rather than a second search. */}
                  {packOptions(r.item).length > 1 && (
                    <button
                      type="button"
                      className="btn btn-quiet h-8 min-h-8 text-xs px-2"
                      onClick={() => addRow(r.item)}
                      title="Add another size of this item to the same delivery"
                    >
                      + size
                    </button>
                  )}
                  <button
                    className="text-fg-subtle hover:text-bad-600 px-2"
                    onClick={() => remove(r.key)}
                    aria-label={`Remove ${r.item.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <AmountInput
                  item={r.item}
                  amount={r.amount}
                  mode={r.mode}
                  ariaLabel={`Quantity of ${r.item.name}`}
                  onChange={(amount, mode) => onAmountChange(r, amount, mode)}
                />

                <label className="space-y-1.5">
                  <span className="block text-xs text-fg-muted">Cost each</span>
                  <input
                    className="input tabular h-11 min-h-11 w-32"
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.packCost}
                    onChange={(e) => update(r.key, { packCost: e.target.value })}
                    placeholder="₹"
                  />
                </label>

                <p className="text-sm text-fg-muted pb-2.5 tabular">
                  {r.packCost ? `= ${formatMoney(lineTotal(r))}` : ''}
                </p>
              </div>

              {r.packCost && <PriceChangeHint row={r} />}
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 && !q.trim() && creatingName === null && !done && (
        <EmptyState
          title="Nothing added yet"
          hint="Search above for something you already stock, or type a new name to set it up."
        />
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {rows.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 justify-between sticky bottom-4">
          <p className="text-sm text-fg-muted">
            {rows.length} line{rows.length === 1 ? '' : 's'}
            {newCount > 0 && ` · ${newCount} new`}
            {totalValue > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-fg tabular">
                  {formatMoney(totalValue)}
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

/**
 * Prices move, and the moment you notice is when you're typing the new one.
 * Saying so here — before it's saved — is the difference between a price
 * change you meant and a typo you didn't.
 */
function PriceChangeHint({ row }: { row: DraftRow }) {
  // Compare like with like: the price already on file for the size that's
  // actually selected, not the item's headline price.
  const oldPack = Number(priceFor(row.item, row.mode)) || 0
  const newPack = Number(row.packCost) || 0
  const sizeName =
    packOptions(row.item).find((o) => o.id === row.mode)?.label ?? row.item.unit

  if (oldPack <= 0 || newPack <= 0) return null

  const diff = newPack - oldPack
  if (Math.abs(diff) < 0.01) return null

  const pct = Math.round((diff / oldPack) * 100)
  const up = diff > 0

  return (
    <p className={`text-xs ${up ? 'text-warn-700' : 'text-good-700'}`}>
      {up ? 'Up' : 'Down'} from {formatMoney(oldPack)} per {sizeName} — {up ? '+' : ''}
      {pct}%. Saving this updates the price for that size.
    </p>
  )
}
