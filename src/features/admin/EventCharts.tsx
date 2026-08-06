import { formatMoney, type EventCostLine } from '@/lib/types'
import type { EventTotals } from './eventReport'

/**
 * Two pictures of one event's money.
 *
 * Both are value-based, so both go quiet when nothing has a price — an empty
 * chart that looks like a real zero is worse than a sentence saying the prices
 * aren't in yet.
 *
 * Colours are a validated categorical set (deutan ΔE 9.3 on the worst adjacent
 * pair), and every segment carries a direct label as well as its hue, so the
 * chart never depends on colour alone to be read.
 */

const USED = '#4f46e5'
const RETURNED = '#059669'
const STILL_OUT = '#b45309'
const DAMAGED = '#8b929d'

/**
 * Where what went out ended up. One bar rather than three numbers, because
 * the useful fact is the proportion — "most of it came back" is the thing you
 * want to see without doing arithmetic.
 */
export function OutcomeBar({ totals }: { totals: EventTotals }) {
  // These four are every possible fate of something that left the store, so
  // they sum to what went out. If they ever don't, the arithmetic is wrong
  // somewhere and the bar would quietly hide it.
  const segments = [
    { label: 'Used up', value: totals.costUsed, color: USED },
    { label: 'Came back', value: totals.costReturned, color: RETURNED },
    { label: 'Still out', value: totals.costStillOut, color: STILL_OUT },
    { label: 'Damaged', value: totals.costDamaged, color: DAMAGED },
  ].filter((s) => s.value > 0)

  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return null

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">What happened to it</h2>
        <p className="text-xs text-fg-muted mt-0.5">
          By value, out of {formatMoney(totals.costTakenOut)} that left the store.
        </p>
      </div>

      {/* 2px surface gap between fills, rounded data-ends on the outer edges. */}
      <div className="flex gap-0.5 h-7" role="img" aria-label="Breakdown of stock value by outcome">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={
              'h-full ' +
              (i === 0 ? 'rounded-l ' : '') +
              (i === segments.length - 1 ? 'rounded-r' : '')
            }
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${formatMoney(s.value)} (${Math.round((s.value / total) * 100)}%)`}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-fg-muted">{s.label}</span>
            <span className="font-medium tabular">{formatMoney(s.value)}</span>
            <span className="text-fg-subtle tabular">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Which items the money actually went on. Magnitude across items, so:
 * horizontal bars, sorted, longest first. One series, so no legend — the
 * heading names it — and the value is direct-labelled rather than needing an
 * axis to decode.
 */
export function TopItemsChart({ lines }: { lines: EventCostLine[] }) {
  const ranked = lines
    .filter((l) => Number(l.cost_used ?? 0) > 0)
    .sort((a, b) => Number(b.cost_used) - Number(a.cost_used))

  if (ranked.length === 0) return null

  const top = ranked.slice(0, 8)
  const rest = ranked.slice(8)
  const restTotal = rest.reduce((s, l) => s + Number(l.cost_used ?? 0), 0)
  const max = Number(top[0]!.cost_used)

  // A ninth series is never a new hue — the tail folds into one "other" row.
  const rows: { name: string; value: number; muted?: boolean }[] = top.map((l) => ({
    name: l.item_name,
    value: Number(l.cost_used),
  }))
  if (rest.length > 0) {
    rows.push({
      name: `${rest.length} other item${rest.length === 1 ? '' : 's'}`,
      value: restTotal,
      muted: true,
    })
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Where the money went</h2>
        <p className="text-xs text-fg-muted mt-0.5">
          Cost of stock used up, highest first.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3">
            <span className="text-xs truncate" title={r.name}>
              {r.name}
            </span>
            <span className="h-2 bg-surface-sunken rounded-sm overflow-hidden">
              <span
                className="block h-full rounded-r-sm"
                style={{
                  width: `${Math.max((r.value / max) * 100, 1.5)}%`,
                  backgroundColor: r.muted ? '#8b929d' : USED,
                }}
                title={`${r.name}: ${formatMoney(r.value)}`}
              />
            </span>
            <span className="text-xs tabular font-medium whitespace-nowrap">
              {formatMoney(r.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
