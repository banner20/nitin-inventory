import { useState, type FormEvent } from 'react'
import {
  correctOwnedQty,
  createItem,
  findSimilarItems,
  setItemPacks,
  updateItem,
} from '@/lib/txns'
import { fetchPriceHistory } from '@/lib/queries'
import { useAsync } from '@/lib/useAsync'
import {
  formatMoney,
  formatQty,
  type Category,
  type Item,
  type ItemAvailability,
  type ItemKind,
} from '@/lib/types'

interface AltPackDraft {
  packSize: string
  packLabel: string
  /** Price of one whole pack of THIS size, as it's written on an invoice. */
  packCost: string
}

/** Type presets so "what kind of quantity is this" is a tap, not a spelling
 * exercise — pcs/ml/g are the only three that show up in this catalog. */
const TYPE_PRESETS: { label: string; unit: string; hint: string }[] = [
  { label: 'Liquid', unit: 'ml', hint: 'bottles, syrups, juices' },
  { label: 'Weight', unit: 'g', hint: 'powders, acids, dry goods' },
  { label: 'Count', unit: 'pcs', hint: 'glassware, tools, garnishes counted whole' },
]

/** What a category is usually measured in — picking "Syrups & Sweeteners"
 * switches the unit to ml automatically, same as picking "Liquid" above.
 * Just a default: change it after if this particular item is the exception. */
const CATEGORY_UNIT: Record<string, string> = {
  Spirits: 'ml',
  'Liqueurs & Bitters': 'ml',
  'Beer & Wine': 'ml',
  Mixers: 'ml',
  'Juices & Purees': 'ml',
  'Syrups & Sweeteners': 'ml',
  Garnishes: 'pcs',
  Ice: 'kg',
  Glassware: 'pcs',
  'Bar Tools': 'pcs',
  'Bar Equipment': 'pcs',
  'Pantry & Condiments': 'pcs',
  'Acids & Mixology Chemicals': 'g',
}

/**
 * Add-or-edit an item, factored out so it behaves identically wherever it
 * appears — the master sheet's own "Add item" button, its per-row "Edit",
 * and Stock In's "this doesn't exist yet" path. One form, one set of rules,
 * one place to fix a bug.
 */
export default function ItemForm({
  categories,
  initialName = '',
  submitLabel,
  editItem,
  onCreated,
  onCancel,
}: {
  categories: Category[]
  initialName?: string
  submitLabel?: string
  /** Pass an existing item to edit it in place instead of creating a new one. */
  editItem?: ItemAvailability
  onCreated: (item: Item) => void
  onCancel?: () => void
}) {
  const isEditing = !!editItem
  const [name, setName] = useState(editItem?.name ?? initialName)
  const [categoryId, setCategoryId] = useState(editItem?.category_id ?? '')
  const [kind, setKind] = useState<ItemKind>(editItem?.kind ?? 'consumable')
  const [unit, setUnit] = useState(editItem?.unit ?? 'ml')
  const [packSize, setPackSize] = useState(
    editItem?.pack_size && Number(editItem.pack_size) > 1 ? String(editItem.pack_size) : '',
  )
  const [packLabel, setPackLabel] = useState(editItem?.pack_label ?? '')
  const [sku, setSku] = useState(editItem?.sku ?? '')
  const [minStock, setMinStock] = useState(String(editItem?.min_stock ?? 0))
  const [aliases, setAliases] = useState((editItem?.aliases ?? []).join(', '))
  const [expiryDate, setExpiryDate] = useState(editItem?.expiry_date ?? '')
  /* Price is entered per pack, because that's how it's bought and how an
     invoice reads. It's stored per base unit, so the conversion happens on
     save rather than in anyone's head. */
  const [packCost, setPackCost] = useState(() => {
    if (editItem?.unit_cost == null) return ''
    const size = editItem.pack_label && Number(editItem.pack_size) > 1 ? Number(editItem.pack_size) : 1
    return String(Number((editItem.unit_cost * size).toFixed(2)))
  })
  /**
   * What you actually have, in whole packs, so a recount is one number rather
   * than a trip through Add stock. Saved as a correcting transaction for the
   * difference, never as an overwrite — see correctOwnedQty.
   */
  const ownedPackSize =
    editItem?.pack_label && Number(editItem.pack_size) > 1 ? Number(editItem.pack_size) : 1
  const [ownedPacks, setOwnedPacks] = useState(() =>
    editItem ? String(Number((Number(editItem.qty_owned) / ownedPackSize).toFixed(3))) : '',
  )
  const [altPacks, setAltPacks] = useState<AltPackDraft[]>(
    (editItem?.alt_packs ?? []).map((p) => ({
      packSize: String(p.pack_size),
      packLabel: p.pack_label,
      packCost:
        p.unit_cost == null ? '' : String(Number((p.unit_cost * Number(p.pack_size)).toFixed(2))),
    })),
  )
  const [similar, setSimilar] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function checkDuplicates(value: string) {
    setName(value)
    if (!isEditing) setSimilar(await findSimilarItems(value))
  }

  function onCategoryChange(id: string) {
    setCategoryId(id)
    const category = categories.find((c) => c.id === id)
    const preset = category ? CATEGORY_UNIT[category.name] : undefined
    if (preset) setUnit(preset)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const validAltPacks = altPacks.filter((p) => p.packSize && p.packLabel.trim())
      const effectivePackSize = packSize ? Number(packSize) : 1
      const enteredPackCost = packCost.trim() === '' ? null : Number(packCost)
      const input = {
        name,
        categoryId: categoryId || null,
        unit,
        sku,
        minStock: Number(minStock) || 0,
        kind,
        packSize: packSize ? Number(packSize) : undefined,
        packLabel: packLabel || null,
        expiryDate: expiryDate || null,
        unitCost:
          enteredPackCost == null || !Number.isFinite(enteredPackCost)
            ? null
            : enteredPackCost / (effectivePackSize > 0 ? effectivePackSize : 1),
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        // Saving this form is a manager confirming the details, which is
        // exactly what the flag was waiting for.
        needsReview: false,
      }

      let item: Item
      if (isEditing) {
        await updateItem(editItem.item_id, input)

        // A recount is posted as a correction for the difference, so history
        // records when the number moved rather than losing the old one.
        const newSize = packSize ? Number(packSize) : 1
        const targetBase = ownedPacks.trim() === '' ? null : Number(ownedPacks) * newSize
        if (targetBase != null && Number.isFinite(targetBase)) {
          await correctOwnedQty(
            editItem.item_id,
            Number(editItem.qty_owned),
            targetBase,
            'Corrected on the master sheet',
          )
        }

        item = { ...editItem, ...input, id: editItem.item_id } as unknown as Item
      } else {
        item = await createItem(input)
      }

      await setItemPacks(
        isEditing ? editItem.item_id : item.id,
        validAltPacks.map((p) => {
          const size = Number(p.packSize)
          const cost = p.packCost.trim() === '' ? null : Number(p.packCost)
          return {
            packSize: size,
            packLabel: p.packLabel,
            // Stored per base unit, entered per pack — the same conversion
            // the default pack gets, so the two can be compared.
            unitCost:
              cost == null || !Number.isFinite(cost) || size <= 0 ? null : cost / size,
          }
        }),
      )

      onCreated(item)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm text-fg-muted">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => void checkDuplicates(e.target.value)}
            placeholder="LED PAR 64"
            autoFocus={!initialName}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Category</span>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <legend className="text-sm text-fg-muted">What kind of thing is it?</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('consumable')}
              className={
                'p-2.5 rounded-lg border text-left transition-colors ' +
                (kind === 'consumable'
                  ? 'border-brand-500 bg-surface-hover'
                  : 'border-line hover:border-line-strong')
              }
            >
              <span className="block text-sm font-medium text-fg">Consumable</span>
              <span className="block text-xs text-fg-muted">
                Spirits, mixers, garnishes, ice — used up, not returned
              </span>
            </button>
            <button
              type="button"
              onClick={() => setKind('returnable')}
              className={
                'p-2.5 rounded-lg border text-left transition-colors ' +
                (kind === 'returnable'
                  ? 'border-brand-500 bg-surface-hover'
                  : 'border-line hover:border-line-strong')
              }
            >
              <span className="block text-sm font-medium text-fg">Returnable</span>
              <span className="block text-xs text-fg-muted">
                Glassware, tools, equipment — expected back
              </span>
            </button>
          </div>
        </fieldset>

        <fieldset className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <legend className="text-sm text-fg-muted">What kind of quantity is it?</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_PRESETS.map((t) => (
              <button
                key={t.unit}
                type="button"
                onClick={() => setUnit(t.unit)}
                className={
                  'p-2.5 rounded-lg border text-left transition-colors ' +
                  (unit === t.unit
                    ? 'border-brand-500 bg-surface-hover'
                    : 'border-line hover:border-line-strong')
                }
              >
                <span className="block text-sm font-medium text-fg">{t.label}</span>
                <span className="block text-xs text-fg-muted">{t.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Unit</span>
          <input
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="ml, pcs, g, kg…"
          />
          <span className="block text-xs text-fg-subtle">
            Set by the category or the presets above — edit directly for anything unusual.
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">SKU (optional)</span>
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>

        {/*
          A recount, without walking through Add stock. Only on edit — a brand
          new item's opening count belongs on the Add stock screen, where it
          gets a supplier and a price alongside it.
        */}
        {isEditing && (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              How many do you have{packLabel ? ` (${packLabel}s)` : ''}?
            </span>
            <input
              className="input tabular"
              type="number"
              min={0}
              step="any"
              value={ownedPacks}
              onChange={(e) => setOwnedPacks(e.target.value)}
            />
            <span className="block text-xs text-fg-subtle">
              {(() => {
                const size = packSize ? Number(packSize) : 1
                const target = ownedPacks.trim() === '' ? null : Number(ownedPacks) * size
                const now = Number(editItem.qty_owned)
                if (target == null || !Number.isFinite(target)) return 'Leave blank to keep it as it is.'
                const delta = Number((target - now).toFixed(3))
                if (delta === 0) return `Unchanged — ${formatQty(now, editItem)} on the books.`
                return delta > 0
                  ? `Adds ${formatQty(delta, editItem)}, recorded as stock found.`
                  : `Removes ${formatQty(-delta, editItem)}, recorded as stock gone.`
              })()}
            </span>
            {Number(editItem.qty_out) > 0 && (
              /* Out is somebody's responsibility, not a number to overwrite —
                 clearing it here would erase who has what. */
              <span className="block text-xs text-warn-700">
                {formatQty(editItem.qty_out, editItem)} is still out with the crew. That comes
                back through Bring back, so it isn't editable here.
              </span>
            )}
          </label>
        )}

        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Minimum stock</span>
          <input
            className="input tabular"
            type="number"
            min={0}
            step="any"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Expires (optional)</span>
          <input
            className="input"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </label>

        <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-sm text-fg-muted">
            Other names people call it, comma separated
          </span>
          <input
            className="input"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="par can, par64, led par"
          />
        </label>
      </div>

      {/*
        Sizes and prices as one list, not two scattered sections.

        A bigger pack is normally cheaper per unit — that's the reason for
        buying one — so each size carries its own price. Reading them as rows
        of a price list makes that obvious; asking for them as separate
        fields several inches apart does not.
      */}
      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <h3 className="text-sm font-medium">Sizes and prices</h3>
          <p className="text-xs text-fg-muted">
            Every size you buy this in, and what one of each costs. Buying it again at a
            different price updates that size on its own — set a price here only for stock
            you already had.
          </p>
          {/* The columns read Size / Called / Cost each, which invites "so
              where's the quantity?" — it's one field, further up, because
              stock is held as a single total rather than a count per size. */}
          <p className="text-xs text-fg-subtle">
            Prices only — how much you have is the one figure above, whichever size you
            count it in.
          </p>
        </div>

        <div className="rounded-lg border border-line overflow-hidden">
          <div className="grid grid-cols-[1.1fr_1.1fr_1fr_2.5rem] gap-px bg-line text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            <div className="bg-surface-alt px-2.5 py-1.5">Size ({unit})</div>
            <div className="bg-surface-alt px-2.5 py-1.5">Called</div>
            <div className="bg-surface-alt px-2.5 py-1.5">Cost each</div>
            <div className="bg-surface-alt" />
          </div>

          {/* The default size. Can't be removed — it's how the item is
              counted everywhere else in the app. */}
          <div className="grid grid-cols-[1.1fr_1.1fr_1fr_2.5rem] gap-2 items-center p-2 border-b border-line">
            <input
              className="input tabular h-10 min-h-10"
              type="number"
              min={0}
              step="any"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
              placeholder="e.g. 700"
              aria-label={`Default size in ${unit}`}
            />
            <input
              className="input h-10 min-h-10"
              value={packLabel}
              onChange={(e) => setPackLabel(e.target.value)}
              placeholder="bottle, crate…"
              aria-label="Default size name"
            />
            <input
              className="input tabular h-10 min-h-10"
              type="number"
              min={0}
              step="0.01"
              value={packCost}
              onChange={(e) => setPackCost(e.target.value)}
              placeholder="₹"
              aria-label={`Cost per ${packLabel || 'default pack'}`}
            />
            <span className="text-[10px] text-fg-subtle text-center leading-tight">main</span>
          </div>

          {altPacks.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.1fr_1.1fr_1fr_2.5rem] gap-2 items-center p-2 border-b border-line last:border-b-0"
            >
              <input
                className="input tabular h-10 min-h-10"
                type="number"
                min={0}
                step="any"
                value={p.packSize}
                onChange={(e) =>
                  setAltPacks((rows) =>
                    rows.map((r, ri) => (ri === i ? { ...r, packSize: e.target.value } : r)),
                  )
                }
                placeholder="e.g. 1000"
                aria-label={`Extra size ${i + 1} in ${unit}`}
              />
              <input
                className="input h-10 min-h-10"
                value={p.packLabel}
                onChange={(e) =>
                  setAltPacks((rows) =>
                    rows.map((r, ri) => (ri === i ? { ...r, packLabel: e.target.value } : r)),
                  )
                }
                placeholder="jug, case, tin…"
                aria-label={`Extra size ${i + 1} name`}
              />
              <input
                className="input tabular h-10 min-h-10"
                type="number"
                min={0}
                step="0.01"
                value={p.packCost}
                onChange={(e) =>
                  setAltPacks((rows) =>
                    rows.map((r, ri) => (ri === i ? { ...r, packCost: e.target.value } : r)),
                  )
                }
                placeholder="₹"
                aria-label={`Cost per ${p.packLabel || `extra size ${i + 1}`}`}
              />
              <button
                type="button"
                className="text-fg-subtle hover:text-bad-600 px-2 justify-self-center"
                onClick={() => setAltPacks((rows) => rows.filter((_, ri) => ri !== i))}
                aria-label={`Remove the ${p.packLabel || 'extra'} size`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-ghost h-9 min-h-9 text-sm px-3"
          onClick={() =>
            setAltPacks((p) => [...p, { packSize: '', packLabel: '', packCost: '' }])
          }
        >
          + Another size
        </button>

        <PerUnitComparison
          unit={unit}
          rows={[
            { size: packSize, label: packLabel || 'main', cost: packCost },
            ...altPacks.map((p) => ({
              size: p.packSize,
              label: p.packLabel,
              cost: p.packCost,
            })),
          ]}
        />

        {isEditing && <PriceHistory itemId={editItem.item_id} />}
      </div>

      {similar.length > 0 && (
        <div className="rounded-lg border border-warn-200 bg-warn-50 p-3 text-sm">
          <p className="text-warn-600 font-medium">
            You may already have this — check before adding a duplicate:
          </p>
          <ul className="text-fg mt-1">
            {similar.map((s) => (
              <li key={s.id}>· {s.name}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-bad-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy
            ? isEditing
              ? 'Saving…'
              : 'Adding…'
            : (submitLabel ?? (isEditing ? 'Save changes' : 'Add item'))}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

/**
 * Which size is actually better value.
 *
 * The whole reason to stock a bulk jug alongside single bottles is that it
 * works out cheaper per millilitre — but nobody can see that from two prices
 * for two different quantities. Doing the division here turns "₹200 and ₹700"
 * into "the jug is 12% cheaper per ml", which is the thing the person
 * entering it actually wants to know.
 */
function PerUnitComparison({
  unit,
  rows,
}: {
  unit: string
  rows: { size: string; label: string; cost: string }[]
}) {
  const priced = rows
    .map((r) => ({
      label: r.label || 'unnamed',
      size: Number(r.size) || 0,
      cost: Number(r.cost) || 0,
    }))
    .filter((r) => r.size > 0 && r.cost > 0)
    .map((r) => ({ ...r, perUnit: r.cost / r.size }))

  if (priced.length < 2) return null

  const cheapest = priced.reduce((a, b) => (b.perUnit < a.perUnit ? b : a))
  const dearest = priced.reduce((a, b) => (b.perUnit > a.perUnit ? b : a))
  const saving =
    dearest.perUnit > 0
      ? Math.round(((dearest.perUnit - cheapest.perUnit) / dearest.perUnit) * 100)
      : 0

  return (
    <div className="rounded-lg border border-line bg-surface-alt p-3 space-y-1.5">
      <p className="text-xs font-medium">Cost per {unit}</p>
      <ul className="space-y-0.5">
        {priced.map((r, i) => (
          <li key={i} className="text-xs text-fg-muted flex justify-between gap-3">
            <span>{r.label}</span>
            <span className="tabular">
              {formatMoney(Number(r.perUnit.toFixed(4)))} / {unit}
              {r.label === cheapest.label && saving > 0 && (
                <span className="ml-1.5 badge badge-good">best value</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {saving > 0 && (
        <p className="text-xs text-fg-subtle">
          Buying as {cheapest.label} works out {saving}% cheaper per {unit} than{' '}
          {dearest.label}.
        </p>
      )}
    </div>
  )
}

/**
 * What this has actually been paid for, over time. The single "current price"
 * above is the number valuation uses; this is the evidence behind it — ₹100
 * in June and ₹120 in August is a fact worth being able to see, and the
 * reason current price isn't just a field someone typed once.
 */
function PriceHistory({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false)
  const history = useAsync(
    () => (open ? fetchPriceHistory(itemId) : Promise.resolve([])),
    [itemId, open],
  )

  const rows = history.data ?? []

  return (
    <div className="pt-1">
      <button
        type="button"
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Hide price history' : 'Show price history'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-line overflow-hidden">
          {history.loading && (
            <p className="text-xs text-fg-subtle p-2.5">Loading…</p>
          )}
          {!history.loading && rows.length === 0 && (
            <p className="text-xs text-fg-subtle p-2.5">
              Never bought through the system yet — so there's no price trail. The next
              time you add stock with a cost, it'll start here.
            </p>
          )}
          {rows.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-surface-alt border-b border-line text-fg-subtle">
                <tr className="text-left">
                  <th className="px-2.5 py-1.5 font-medium">When</th>
                  <th className="px-2.5 py-1.5 font-medium text-right">Price/unit</th>
                  <th className="px-2.5 py-1.5 font-medium text-right">Qty</th>
                  <th className="px-2.5 py-1.5 font-medium text-right">Total</th>
                  <th className="px-2.5 py-1.5 font-medium">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((h, i) => (
                  <tr key={i}>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {new Date(h.occurred_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular whitespace-nowrap">
                      {formatMoney(h.unit_cost)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular">{Number(h.qty)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular whitespace-nowrap">
                      {formatMoney(h.line_total)}
                    </td>
                    <td className="px-2.5 py-1.5 text-fg-subtle truncate">
                      {h.vendor ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
