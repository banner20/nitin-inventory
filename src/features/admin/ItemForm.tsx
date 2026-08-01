import { useState, type FormEvent } from 'react'
import { createItem, findSimilarItems, setItemPacks, updateItem } from '@/lib/txns'
import type { Category, Item, ItemAvailability, ItemKind } from '@/lib/types'

interface AltPackDraft {
  packSize: string
  packLabel: string
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
  const [altPacks, setAltPacks] = useState<AltPackDraft[]>(
    (editItem?.alt_packs ?? []).map((p) => ({
      packSize: String(p.pack_size),
      packLabel: p.pack_label,
    })),
  )
  const [similar, setSimilar] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function checkDuplicates(value: string) {
    setName(value)
    if (!isEditing) setSimilar(await findSimilarItems(value))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const validAltPacks = altPacks.filter((p) => p.packSize && p.packLabel.trim())
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
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      }

      let item: Item
      if (isEditing) {
        await updateItem(editItem.item_id, input)
        item = { ...editItem, ...input, id: editItem.item_id } as unknown as Item
      } else {
        item = await createItem(input)
      }

      await setItemPacks(
        isEditing ? editItem.item_id : item.id,
        validAltPacks.map((p) => ({ packSize: Number(p.packSize), packLabel: p.packLabel })),
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
          <span className="text-sm text-ink-400">Name</span>
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
          <span className="text-sm text-ink-400">Category</span>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
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
          <legend className="text-sm text-ink-400">What kind of thing is it?</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('consumable')}
              className={
                'p-2.5 rounded-lg border text-left transition-colors ' +
                (kind === 'consumable'
                  ? 'border-brand-500 bg-ink-850'
                  : 'border-ink-700 hover:border-ink-600')
              }
            >
              <span className="block text-sm font-medium text-white">Consumable</span>
              <span className="block text-xs text-ink-400">
                Spirits, mixers, garnishes, ice — used up, not returned
              </span>
            </button>
            <button
              type="button"
              onClick={() => setKind('returnable')}
              className={
                'p-2.5 rounded-lg border text-left transition-colors ' +
                (kind === 'returnable'
                  ? 'border-brand-500 bg-ink-850'
                  : 'border-ink-700 hover:border-ink-600')
              }
            >
              <span className="block text-sm font-medium text-white">Returnable</span>
              <span className="block text-xs text-ink-400">
                Glassware, tools, equipment — expected back
              </span>
            </button>
          </div>
        </fieldset>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Unit</span>
          <input
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="ml, pcs, g, kg…"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Pack size (optional)</span>
          <input
            className="input tabular"
            type="number"
            min={0}
            step="any"
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            placeholder="750"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Pack name (optional)</span>
          <input
            className="input"
            value={packLabel}
            onChange={(e) => setPackLabel(e.target.value)}
            placeholder="bottle, crate, bag…"
          />
        </label>

        {(packSize || packLabel) && (
          <p className="text-xs text-ink-600 sm:col-span-2 lg:col-span-3 -mt-2">
            One {packLabel || 'pack'} = {packSize || '?'} {unit}. Leave both blank if it's just
            counted loose, one at a time.
          </p>
        )}

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">SKU (optional)</span>
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Minimum stock</span>
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
          <span className="text-sm text-ink-400">Expires (optional)</span>
          <input
            className="input"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </label>

        <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-sm text-ink-400">
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

      {(packSize || packLabel) && (
        <div className="space-y-2 border-t border-ink-800 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">
              Also bought in other sizes at once? (e.g. this syrup as bottles
              <em>and</em> a bulk jug)
            </span>
            <button
              type="button"
              className="btn btn-ghost h-9 min-h-9 text-sm px-3"
              onClick={() => setAltPacks((p) => [...p, { packSize: '', packLabel: '' }])}
            >
              + Add another size
            </button>
          </div>

          {altPacks.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className="input tabular"
                type="number"
                min={0}
                step="any"
                value={p.packSize}
                onChange={(e) =>
                  setAltPacks((rows) =>
                    rows.map((r, ri) => (ri === i ? { ...r, packSize: e.target.value } : r)),
                  )
                }
                placeholder={`Size in ${unit}, e.g. 1000`}
              />
              <input
                className="input"
                value={p.packLabel}
                onChange={(e) =>
                  setAltPacks((rows) =>
                    rows.map((r, ri) => (ri === i ? { ...r, packLabel: e.target.value } : r)),
                  )
                }
                placeholder="jug, case, tin…"
              />
              <button
                type="button"
                className="text-ink-600 hover:text-bad-500 px-2"
                onClick={() => setAltPacks((rows) => rows.filter((_, ri) => ri !== i))}
                aria-label="Remove this size"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {similar.length > 0 && (
        <div className="rounded-lg border border-warn-500/40 bg-warn-500/10 p-3 text-sm">
          <p className="text-warn-500 font-medium">
            You may already have this — check before adding a duplicate:
          </p>
          <ul className="text-ink-200 mt-1">
            {similar.map((s) => (
              <li key={s.id}>· {s.name}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-bad-500">{error}</p>}

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
