import clsx from 'clsx'

export interface PackOption {
  /** 'default' for the item's primary pack_size/pack_label; an item_packs id
   * for anything extra (e.g. a 1L jug alongside the usual 250ml bottle). */
  id: string
  size: number
  label: string
}

export interface PackItem {
  unit: string
  pack_size: number
  pack_label: string | null
  alt_packs?: { id: string; pack_size: number; pack_label: string }[] | null
}

/** The id of whichever pack option is selected, or 'base' to enter in the
 * item's raw unit (ml, g, pcs). Not a fixed two-state toggle any more —
 * some items are bought in more than one pack size at once. */
export type AmountMode = string

const BASE = 'base'

/** "750ml" or "1.5L" — the size on the pill, so two pack options that
 * happen to share a label word (two sizes both called "bottle") still read
 * as different things. */
function formatSize(size: number, unit: string): string {
  if (unit === 'ml' && size >= 1000) {
    const litres = size / 1000
    return `${litres % 1 === 0 ? litres : litres.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}L`
  }
  return `${size}${unit}`
}

/** Every way this item can be counted: its default pack, then any extras. */
export function packOptions(item: PackItem): PackOption[] {
  const opts: PackOption[] = []
  if (item.pack_label && Number(item.pack_size) > 1) {
    opts.push({ id: 'default', size: Number(item.pack_size), label: item.pack_label })
  }
  for (const p of item.alt_packs ?? []) {
    opts.push({ id: p.id, size: Number(p.pack_size), label: p.pack_label })
  }
  return opts
}

export function usesPacks(item: PackItem): boolean {
  return packOptions(item).length > 0
}

function findOption(item: PackItem, mode: AmountMode): PackOption | undefined {
  return packOptions(item).find((o) => o.id === mode)
}

/** The pack option a fresh row should start on: the default pack when there
 * is one, otherwise the base unit. */
export function defaultMode(item: PackItem): AmountMode {
  return usesPacks(item) ? 'default' : BASE
}

/** Whatever the person typed, in the base unit the ledger stores. */
export function amountToBase(amount: string, mode: AmountMode, item: PackItem): number {
  const n = Number(amount) || 0
  const opt = mode === BASE ? undefined : findOption(item, mode)
  return opt ? n * opt.size : n
}

/** Base units back into whichever unit is currently on screen. */
export function baseToAmount(base: number, mode: AmountMode, item: PackItem): number {
  const opt = mode === BASE ? undefined : findOption(item, mode)
  return opt ? base / opt.size : base
}

/**
 * Quantity entry that can speak any of an item's units.
 *
 * Four bottles of gin is four bottles; the half-used one that comes back is
 * 375 ml, not 0.5 bottles. And some items — a syrup bought as both 250ml
 * bottles and a 1L jug — genuinely have more than one right answer to "how
 * is this counted." Switching converts the value so it never silently
 * changes meaning, whichever unit someone started in.
 */
export function AmountInput({
  item,
  amount,
  mode,
  onChange,
  ariaLabel,
  withSteppers = false,
}: {
  item: PackItem
  amount: string
  mode: AmountMode
  onChange: (amount: string, mode: AmountMode) => void
  ariaLabel: string
  withSteppers?: boolean
}) {
  const options = packOptions(item)

  function switchMode(next: AmountMode) {
    if (next === mode) return
    const base = amountToBase(amount, mode, item)
    const converted = baseToAmount(base, next, item)
    onChange(String(Number(converted.toFixed(3))), next)
  }

  function bump(by: number) {
    // Selecting a pack option steps by one pack. In the raw base unit, a
    // step of "1ml" is useless — step by one primary-pack's worth instead,
    // when the item has one; a genuinely unpacked item steps by 1.
    const step =
      mode === BASE ? by * (options[0]?.size ?? 1) : by
    const next = Math.max(0, (Number(amount) || 0) + step)
    onChange(String(Number(next.toFixed(3))), mode)
  }

  const currentOpt = mode === BASE ? undefined : findOption(item, mode)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {options.length > 0 ? (
          <div
            className="inline-flex rounded-lg border border-line overflow-hidden flex-wrap"
            role="group"
            aria-label="Size"
          >
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => switchMode(o.id)}
                className={clsx(
                  'px-3 py-1.5 min-h-11 text-sm font-medium transition-colors whitespace-nowrap leading-tight',
                  mode === o.id
                    ? 'bg-brand-500 text-white'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                <span className="block">{formatSize(o.size, item.unit)}</span>
                <span className="block text-[10px] opacity-80">{o.label}s</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => switchMode(BASE)}
              className={clsx(
                'px-3 min-h-11 text-sm font-medium transition-colors',
                mode === BASE ? 'bg-brand-500 text-white' : 'text-fg-muted hover:text-fg',
              )}
            >
              {item.unit}
            </button>
          </div>
        ) : (
          <span className="text-sm text-fg-muted">{item.unit}</span>
        )}

        {withSteppers && (
          <button
            type="button"
            className="btn btn-ghost size-11 min-h-11 px-0 text-lg"
            onClick={() => bump(-1)}
            aria-label="One less"
          >
            −
          </button>
        )}

        <input
          className="input tabular text-center w-24"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChange(e.target.value, mode)}
          aria-label={ariaLabel}
        />

        {withSteppers && (
          <button
            type="button"
            className="btn btn-ghost size-11 min-h-11 px-0 text-lg"
            onClick={() => bump(1)}
            aria-label="One more"
          >
            +
          </button>
        )}
      </div>

      {Number(amount) > 0 && (
        <p className="text-xs text-fg-subtle tabular">
          {currentOpt
            ? `= ${amountToBase(amount, mode, item).toLocaleString('en-IN')} ${item.unit}`
            : options.length === 1
              ? (() => {
                  const only = options[0]!
                  const packs = Number(baseToAmount(amountToBase(amount, mode, item), only.id, item).toFixed(3))
                  return `= ${packs} ${only.label}${packs === 1 ? '' : 's'}`
                })()
              : null}
        </p>
      )}
    </div>
  )
}
