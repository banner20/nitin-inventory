import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { fetchMyOpenBalances } from '@/lib/queries'
import { postTxn, type PostLine } from '@/lib/txns'
import {
  AmountInput,
  amountToBase,
  usesPacks,
  type AmountMode,
} from '@/components/AmountInput'
import { formatPacks, type LineCondition, type OpenBalance } from '@/lib/types'

/** Reasons stock didn't come back, in the order a bar actually uses them. */
const REASONS: { value: LineCondition; label: string; hint: string }[] = [
  { value: 'consumed', label: 'Served', hint: 'Poured and sold — normal' },
  { value: 'wasted', label: 'Spilled / spoiled', hint: 'A cost worth watching' },
  { value: 'damaged', label: 'Damaged', hint: 'Came back broken' },
  { value: 'lost', label: 'Missing', hint: 'Unaccounted for' },
]

interface Row {
  bal: OpenBalance
  back: string
  mode: AmountMode
  reason: LineCondition
}

function toBase(row: Row): number {
  return amountToBase(row.back, row.mode, row.bal)
}

function packsOut(b: OpenBalance): number {
  return usesPacks(b) ? Number(b.outstanding) / Number(b.pack_size) : Number(b.outstanding)
}

/**
 * The return screen opens pre-filled with exactly what went out, so the common
 * case is confirming rather than typing. Whatever doesn't come back has to be
 * explained — and for a bar the default explanation depends on what it is:
 * gin was almost certainly served, a jigger almost certainly wasn't.
 */
export default function BringBack() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const personId = profile?.id
  const balances = useAsync(
    () => (personId ? fetchMyOpenBalances(personId) : Promise.resolve([])),
    [personId],
  )

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

  // Pre-fill: returnables default to everything coming back, consumables to
  // nothing, because that is what usually happened.
  useEffect(() => {
    if (!eventId) return
    const lines = byEvent.get(eventId) ?? []
    setRows(
      lines.map((bal) => ({
        bal,
        back: bal.kind === 'returnable' ? String(Number(packsOut(bal).toFixed(3))) : '0',
        mode: usesPacks(bal) ? 'pack' : 'base',
        reason: bal.kind === 'returnable' ? 'lost' : 'consumed',
      })),
    )
  }, [eventId, byEvent])

  async function post() {
    if (!eventId || !profile) return
    setBusy(true)
    setError(null)
    try {
      const lines: PostLine[] = []
      for (const row of rows) {
        const back = Math.min(toBase(row), Number(row.bal.outstanding))
        const gap = Number(row.bal.outstanding) - back
        if (back > 0) lines.push({ item_id: row.bal.item_id, qty: back, condition: 'ok' })
        if (gap > 0) lines.push({ item_id: row.bal.item_id, qty: gap, condition: row.reason })
      }
      if (lines.length === 0) throw new Error('Nothing to record.')

      await postTxn({
        type: 'IN',
        lines,
        eventId,
        personId: profile.id,
      })
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
          <h1 className="text-lg font-semibold text-white">Bringing stock back</h1>
          <p className="text-sm text-ink-400">Which event are you returning from?</p>
        </header>

        {balances.loading && <p className="text-sm text-ink-400">Loading…</p>}
        {balances.error && <p className="text-sm text-bad-500">{balances.error.message}</p>}

        {!balances.loading && events.length === 0 && (
          <div className="card p-6 text-center text-sm text-ink-400">
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
                  <p className="font-medium text-white">{first.event_name}</p>
                  <p className="text-sm text-ink-400">
                    {lines.length} item{lines.length === 1 ? '' : 's'} still out
                    {first.overdue && <span className="text-warn-500"> · overdue</span>}
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
    <div className="space-y-4 pb-28">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Returning from</p>
          <h1 className="font-semibold text-white truncate">{eventName}</h1>
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
              mode: usesPacks(r.bal) ? 'pack' : 'base',
              back: String(Number(packsOut(r.bal).toFixed(3))),
            })),
          )
        }
      >
        Everything came back
      </button>

      <ul className="card divide-y divide-ink-800">
        {rows.map((row, idx) => {
          const out = Number(row.bal.outstanding)
          const back = Math.min(toBase(row), out)
          const gap = out - back
          const over = toBase(row) > out
          return (
            <li key={row.bal.item_id} className="p-3 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-white truncate">{row.bal.item_name}</p>
                <p className="text-xs text-ink-400 shrink-0">
                  {formatPacks(out, row.bal)} out
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm text-ink-400">Coming back</span>
                <AmountInput
                  item={row.bal}
                  amount={row.back}
                  mode={row.mode}
                  ariaLabel={`Amount of ${row.bal.item_name} coming back`}
                  onChange={(back, mode) =>
                    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, back, mode } : r)))
                  }
                />
              </div>

              {over && (
                <p className="text-xs text-warn-500">
                  That's more than went out — capped at {formatPacks(out, row.bal)}.
                </p>
              )}

              {gap > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-ink-400">
                    {formatPacks(gap, row.bal)} not coming back —
                  </p>
                  <select
                    className="input h-10 min-h-10 text-sm"
                    value={row.reason}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((r, i) =>
                          i === idx ? { ...r, reason: e.target.value as LineCondition } : r,
                        ),
                      )
                    }
                    aria-label={`Why ${row.bal.item_name} is not coming back`}
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} — {r.hint}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {error && <p className="text-sm text-bad-500">{error}</p>}

      <div className="fixed bottom-16 inset-x-0 p-3 bg-ink-950/95 backdrop-blur border-t border-ink-800">
        <button className="btn btn-primary w-full" onClick={() => void post()} disabled={busy}>
          {busy ? 'Saving…' : 'Record return'}
        </button>
      </div>
    </div>
  )
}
