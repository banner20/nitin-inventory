import clsx from 'clsx'

export interface PackItem {
  unit: string
  pack_size: number
  pack_label: string | null
}

export type AmountMode = 'pack' | 'base'

export function usesPacks(item: PackItem): boolean {
  return Boolean(item.pack_label) && Number(item.pack_size) > 1
}

/** Whatever the person typed, in the base unit the ledger stores. */
export function amountToBase(amount: string, mode: AmountMode, item: PackItem): number {
  const n = Number(amount) || 0
  return mode === 'pack' && usesPacks(item) ? n * Number(item.pack_size) : n
}

/** Base units back into whichever unit is currently on screen. */
export function baseToAmount(base: number, mode: AmountMode, item: PackItem): number {
  return mode === 'pack' && usesPacks(item) ? base / Number(item.pack_size) : base
}

/**
 * Quantity entry that can speak either unit.
 *
 * Four bottles of gin is four bottles; the half-used one that comes back is
 * 375 ml, not 0.5 bottles. Forcing either unit on both ends of the job makes
 * somebody do arithmetic in their head at 2am, so the toggle converts the
 * value as it switches and the amount never silently changes meaning.
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
  const packs = usesPacks(item)

  function switchMode(next: AmountMode) {
    if (next === mode || !packs) return
    const base = amountToBase(amount, mode, item)
    const converted = baseToAmount(base, next, item)
    onChange(String(Number(converted.toFixed(3))), next)
  }

  function bump(by: number) {
    const step = mode === 'pack' ? by : by * (packs ? Number(item.pack_size) : 1)
    const next = Math.max(0, (Number(amount) || 0) + step)
    onChange(String(Number(next.toFixed(3))), mode)
  }

  const unitLabel = mode === 'pack' && packs ? `${item.pack_label}s` : item.unit

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
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

        {packs ? (
          <div
            className="inline-flex rounded-lg border border-ink-700 overflow-hidden"
            role="group"
            aria-label="Unit"
          >
            {(['pack', 'base'] as AmountMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={clsx(
                  'px-3 h-11 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-brand-500 text-ink-950'
                    : 'text-ink-400 hover:text-ink-200',
                )}
              >
                {m === 'pack' ? `${item.pack_label}s` : item.unit}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-ink-400">{unitLabel}</span>
        )}
      </div>

      {packs && Number(amount) > 0 && (
        <p className="text-xs text-ink-600 tabular">
          ={' '}
          {mode === 'pack'
            ? `${amountToBase(amount, mode, item).toLocaleString('en-IN')} ${item.unit}`
            : `${Number(baseToAmount(amountToBase(amount, mode, item), 'pack', item).toFixed(3))} ${item.pack_label}${
                Number(amount) === Number(item.pack_size) ? '' : 's'
              }`}
        </p>
      )}
    </div>
  )
}
