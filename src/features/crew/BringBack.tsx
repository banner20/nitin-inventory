import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { useIdempotencyKey } from '@/lib/useIdempotencyKey'
import { fetchMyOpenBalances } from '@/lib/queries'
import { postTxn, type PostLine } from '@/lib/txns'
import {
  AmountInput,
  amountToBase,
  defaultMode,
  packOptions,
  type AmountMode,
} from '@/components/AmountInput'
import { formatQty, type LineCondition, type OpenBalance } from '@/lib/types'

/** Why stock didn't come back. Only ever seen by someone logging a problem. */
const ISSUES: { value: LineCondition; label: string }[] = [
  { value: 'consumed', label: 'Served' },
  { value: 'wasted', label: 'Spilled' },
  { value: 'damaged', label: 'Broken' },
  { value: 'lost', label: 'Missing' },
]

const ISSUE_LABEL: Record<LineCondition, string> = {
  ok: 'returned',
  loose: 'loose',
  consumed: 'served',
  wasted: 'spilled',
  damaged: 'broken',
  lost: 'missing',
}

interface Row {
  bal: OpenBalance
  /** Whole sealed packs coming back — posts as 'ok'. */
  sealedBack: string
  sealedMode: AmountMode
  /** However much is left in an opened bottle — posts as 'loose', separate
   * from sealedBack rather than inferred from it, so it's never a guess. */
  looseBack: string
  reason: LineCondition
  /** Whether this line's reason picker has been opened. */
  issueOpen: boolean
}

function sealedBase(row: Row): number {
  return amountToBase(row.sealedBack, row.sealedMode, row.bal)
}

function looseBase(row: Row): number {
  return Number(row.looseBack) || 0
}

function toBase(row: Row): number {
  return sealedBase(row) + looseBase(row)
}

/** Outstanding amount in terms of the item's default pack, for the "All
 * back" quick-fill — an alt pack size is a less common way to return it. */
function packsOut(b: OpenBalance): number {
  const primary = packOptions(b)[0]
  return primary ? Number(b.outstanding) / primary.size : Number(b.outstanding)
}

/** The reason that needs no explanation, given what the thing is. */
function defaultReason(b: OpenBalance): LineCondition {
  return b.kind === 'returnable' ? 'lost' : 'consumed'
}

/**
 * The return screen opens pre-filled with exactly what went out, so the common
 * case is confirming rather than typing. Nothing here is compulsory: gin that
 * doesn't come back was served, glassware that does is simply back. Logging a
 * problem is one tap away for the nights when there is one, and out of the way
 * on the nights when there isn't.
 */
export default function BringBack() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const personId = profile?.id
  const balances = useAsync(
    () => (personId ? fetchMyOpenBalances(personId) : Promise.resolve([])),
    [personId],
  )

  const idem = useIdempotencyKey()
  const [eventId, setEventId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byEvent = useMemo(() => {
    const map = new Map<string, OpenBalance[]>()
    for (const b of balances.data ?? []) {
      const list = map.get(b.event_id) ?? []
      list.push(b)
      map.set(b.event_id, list)
    }
    return map
  }, [balances.data])

  // Returnables default to everything coming back, consumables to nothing,
  // because that is what usually happened.
  useEffect(() => {
    if (!eventId) return
    setRows(
      (byEvent.get(eventId) ?? []).map((bal) => ({
        bal,
        sealedBack: bal.kind === 'returnable' ? String(Number(packsOut(bal).toFixed(3))) : '0',
        sealedMode: defaultMode(bal),
        looseBack: '0',
        reason: defaultReason(bal),
        issueOpen: false,
      })),
    )
  }, [eventId, byEvent])

  function patch(idx: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }

  const issueCount = rows.filter(
    (r) => Number(r.bal.outstanding) - Math.min(toBase(r), Number(r.bal.outstanding)) > 0
      && r.reason !== 'consumed',
  ).length

  async function post() {
    if (!eventId || !profile) return
    setBusy(true)
    setError(null)
    try {
      const lines: PostLine[] = []
      for (const row of rows) {
        const total = Math.min(toBase(row), Number(row.bal.outstanding))
        const gap = Number(row.bal.outstanding) - total
        // Sealed and loose are capped together at what's outstanding, sealed
        // taking priority — if someone overstates either, the loose figure
        // gives way first since it's the softer of the two claims.
        const sealed = Math.min(sealedBase(row), total)
        const loose = Math.max(0, total - sealed)
        if (sealed > 0) lines.push({ item_id: row.bal.item_id, qty: sealed, condition: 'ok' })
        if (loose > 0) lines.push({ item_id: row.bal.item_id, qty: loose, condition: 'loose' })
        if (gap > 0) lines.push({ item_id: row.bal.item_id, qty: gap, condition: row.reason })
      }
      if (lines.length === 0) throw new Error('Nothing to record.')

      await postTxn({
        type: 'IN',
        lines,
        eventId,
        personId: profile.id,
        clientUuid: idem.current(),
      })
      idem.reset()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  // ---- pick the event ------------------------------------------------------
  if (!eventId) {
    const events = [...byEvent.entries()]
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-lg font-semibold">Bringing stock back</h1>
          <p className="text-sm text-fg-muted">Which event are you returning from?</p>
        </header>

        {balances.loading && <p className="text-sm text-fg-muted">Loading…</p>}
        {balances.error && <p className="text-sm text-bad-600">{balances.error.message}</p>}

        {!balances.loading && events.length === 0 && (
          <div className="card p-6 text-center text-sm text-fg-muted">
            You have nothing signed out. Nothing to bring back.
          </div>
        )}

        <ul className="space-y-2">
          {events.map(([id, lines]) => {
            const first = lines[0]
            if (!first) return null
            return (
              <li key={id}>
                <button
                  className="card w-full text-left p-4 hover:border-brand-500 transition-colors"
                  onClick={() => setEventId(id)}
                >
                  <p className="font-medium text-fg">{first.event_name}</p>
                  <p className="text-sm text-fg-muted">
                    {lines.length} item{lines.length === 1 ? '' : 's'} still out
                    {first.overdue && <span className="text-warn-600"> · overdue</span>}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const eventName = rows[0]?.bal.event_name ?? ''

  return (
    <div className="space-y-3 pb-32">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">Returning from</p>
          <h1 className="font-semibold text-fg truncate">{eventName}</h1>
        </div>
        <button
          className="btn btn-ghost h-9 min-h-9 text-sm px-3"
          onClick={() => setEventId(null)}
        >
          Change
        </button>
      </header>

      <button
        className="btn btn-ghost w-full"
        onClick={() =>
          setRows((rs) =>
            rs.map((r) => ({
              ...r,
              sealedMode: defaultMode(r.bal),
              sealedBack: String(Number(packsOut(r.bal).toFixed(3))),
              looseBack: '0',
            })),
          )
        }
      >
        Everything came back
      </button>

      <ul className="space-y-3">
        {rows.map((row, idx) => {
          const out = Number(row.bal.outstanding)
          const back = Math.min(toBase(row), out)
          const gap = out - back
          const over = toBase(row) > out
          const flagged = gap > 0 && row.reason !== 'consumed'
          const sealed = Math.min(sealedBase(row), back)
          const loose = Math.max(0, back - sealed)

          return (
            <li
              key={row.bal.item_id}
              className={clsx(
                'card p-4 space-y-3',
                flagged && 'border-warn-300',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium truncate">{row.bal.item_name}</p>
                <p className="text-xs text-fg-muted shrink-0">{formatQty(out, row.bal)} out</p>
              </div>

              {/* Two taps cover the overwhelming majority of lines. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={clsx(
                    'btn',
                    back === out && !over ? 'btn-primary' : 'btn-ghost',
                  )}
                  onClick={() =>
                    patch(idx, {
                      sealedMode: defaultMode(row.bal),
                      sealedBack: String(Number(packsOut(row.bal).toFixed(3))),
                      looseBack: '0',
                    })
                  }
                >
                  All back
                </button>
                <button
                  className={clsx('btn', back === 0 ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => patch(idx, { sealedBack: '0', looseBack: '0' })}
                >
                  {row.bal.kind === 'returnable' ? 'None back' : 'All used'}
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-fg-muted">Sealed, unopened</span>
                <AmountInput
                  item={row.bal}
                  amount={row.sealedBack}
                  mode={row.sealedMode}
                  ariaLabel={`Sealed ${row.bal.item_name} coming back`}
                  onChange={(sealedBack, sealedMode) => patch(idx, { sealedBack, sealedMode })}
                />
              </div>

              {row.bal.kind === 'consumable' && (
                <div className="space-y-1">
                  <span className="text-xs text-fg-muted">Loose (opened, exact amount)</span>
                  <div className="flex items-center gap-2">
                    <input
                      className="input tabular text-center w-24"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={row.looseBack}
                      onChange={(e) => patch(idx, { looseBack: e.target.value })}
                      aria-label={`Loose amount of ${row.bal.item_name} coming back`}
                    />
                    <span className="text-sm text-fg-muted">{row.bal.unit}</span>
                  </div>
                </div>
              )}

              {over && (
                <p className="text-xs text-warn-600">
                  More than went out — capped at {formatQty(out, row.bal)}.
                </p>
              )}

              {loose > 0 && (
                <p className="text-xs text-fg-muted">
                  {sealed > 0 && <>{formatQty(sealed, row.bal)} sealed · </>}
                  <span className="text-warn-600">
                    {formatQty(loose, row.bal)} loose, not a full pack
                  </span>
                </p>
              )}

              {gap > 0 &&
                (row.issueOpen ? (
                  <div className="space-y-2">
                    <p className="text-xs text-fg-muted">
                      {formatQty(gap, row.bal)} didn’t come back — what happened?
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {ISSUES.map((o) => (
                        <button
                          key={o.value}
                          className={clsx(
                            'btn px-1 text-sm',
                            row.reason === o.value ? 'btn-primary' : 'btn-ghost',
                          )}
                          onClick={() => patch(idx, { reason: o.value })}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-fg-muted">
                      {formatQty(gap, row.bal)}{' '}
                      <span className={flagged ? 'text-warn-600' : ''}>
                        {ISSUE_LABEL[row.reason]}
                      </span>
                    </p>
                    <button
                      className="btn btn-ghost text-sm px-4 shrink-0"
                      onClick={() => patch(idx, { issueOpen: true })}
                    >
                      Log issue
                    </button>
                  </div>
                ))}
            </li>
          )
        })}
      </ul>

      {error && <p className="text-sm text-bad-600">{error}</p>}

      <div className="fixed bottom-16 inset-x-0 p-3 bg-surface/95 backdrop-blur border-t border-line space-y-1">
        {issueCount > 0 && (
          <p className="text-xs text-warn-600 text-center">
            {issueCount} issue{issueCount === 1 ? '' : 's'} logged
          </p>
        )}
        <button className="btn btn-primary w-full" onClick={() => void post()} disabled={busy}>
          {busy ? 'Saving…' : 'Record return'}
        </button>
      </div>
    </div>
  )
}
