import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { fetchActiveEvents } from '@/lib/events'
import { postTxn, type PostLine } from '@/lib/txns'
import {
  formatPacks,
  itemMatches,
  type EventRecord,
  type ItemAvailability,
} from '@/lib/types'

interface BasketRow {
  item: ItemAvailability
  /** In packs when the item has them, else base units. */
  amount: string
}

function usesPacks(item: ItemAvailability): boolean {
  return Boolean(item.pack_label) && Number(item.pack_size) > 1
}

function toBase(row: BasketRow): number {
  const n = Number(row.amount) || 0
  return usesPacks(row.item) ? n * Number(row.item.pack_size) : n
}

/**
 * Signing stock out to an event. Deliberately two steps — pick the job, then
 * fill the van — because "which event is this for" is the one thing that must
 * never be guessed.
 */
export default function TakeOut() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const events = useAsync(fetchActiveEvents, [])
  const items = useAsync(fetchItemAvailability, [])

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [q, setQ] = useState('')
  const [basket, setBasket] = useState<BasketRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = new Set(basket.map((b) => b.item.item_id))

  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? []).filter((i) => itemMatches(i, q) && !chosen.has(i.item_id)).slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, basket])

  async function post() {
    if (!event || !profile) return
    setBusy(true)
    setError(null)
    try {
      const lines: PostLine[] = basket
        .filter((b) => toBase(b) > 0)
        .map((b) => ({ item_id: b.item.item_id, qty: toBase(b) }))

      if (lines.length === 0) throw new Error('Add something first.')

      await postTxn({
        type: 'OUT',
        lines,
        eventId: event.id,
        personId: profile.id,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  // ---- step 1: which job? --------------------------------------------------
  if (!event) {
    const list = events.data ?? []
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-lg font-semibold text-white">Taking stock out</h1>
          <p className="text-sm text-ink-400">Which event is this for?</p>
        </header>

        {events.loading && <p className="text-sm text-ink-400">Loading…</p>}
        {events.error && <p className="text-sm text-bad-500">{events.error.message}</p>}

        {!events.loading && list.length === 0 && (
          <div className="card p-5 text-center space-y-2">
            <p className="text-sm text-ink-400">No events are open right now.</p>
            <p className="text-xs text-ink-600">
              A manager needs to create one before stock can go out.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <button
                className="card w-full text-left p-4 hover:border-brand-500 transition-colors"
                onClick={() => setEvent(e)}
              >
                <p className="font-medium text-white">{e.name}</p>
                <p className="text-sm text-ink-400">
                  {e.venue ? `${e.venue} · ` : ''}
                  {new Date(e.starts_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // ---- step 2: fill the van ------------------------------------------------
  return (
    <div className="space-y-4 pb-28">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Taking out for</p>
          <h1 className="font-semibold text-white truncate">{event.name}</h1>
        </div>
        <button className="btn btn-ghost h-9 min-h-9 text-sm px-3" onClick={() => setEvent(null)}>
          Change
        </button>
      </header>

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search — gin, tonic, jigger…"
        autoCorrect="off"
        spellCheck={false}
      />

      {matches.length > 0 && (
        <ul className="card divide-y divide-ink-800">
          {matches.map((m) => (
            <li key={m.item_id}>
              <button
                className="w-full text-left px-3 py-3 hover:bg-ink-850 flex justify-between gap-3 items-center"
                onClick={() => {
                  setBasket((b) => [...b, { item: m, amount: '1' }])
                  setQ('')
                }}
              >
                <span className="min-w-0">
                  <span className="block text-ink-200 truncate">{m.name}</span>
                  <span className="block text-xs text-ink-600">
                    {formatPacks(m.qty_available, m)} available
                  </span>
                </span>
                <span className="text-brand-400 text-xl shrink-0">+</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q && matches.length === 0 && (
        <p className="text-sm text-ink-400">Nothing matches “{q}”.</p>
      )}

      {basket.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-400">
          Search above to start loading.
        </div>
      ) : (
        <ul className="card divide-y divide-ink-800">
          {basket.map((row) => {
            const short = toBase(row) > Number(row.item.qty_available)
            return (
              <li key={row.item.item_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white truncate">{row.item.name}</p>
                    <p className="text-xs text-ink-600">
                      {formatPacks(row.item.qty_available, row.item)} available
                    </p>
                  </div>
                  <button
                    className="text-ink-600 hover:text-bad-500 px-2"
                    onClick={() =>
                      setBasket((b) => b.filter((x) => x.item.item_id !== row.item.item_id))
                    }
                    aria-label={`Remove ${row.item.name}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-ghost size-11 min-h-11 px-0 text-lg"
                    onClick={() =>
                      setBasket((b) =>
                        b.map((x) =>
                          x.item.item_id === row.item.item_id
                            ? { ...x, amount: String(Math.max(0, (Number(x.amount) || 0) - 1)) }
                            : x,
                        ),
                      )
                    }
                    aria-label="One less"
                  >
                    −
                  </button>
                  <input
                    className="input tabular text-center w-20"
                    type="number"
                    min={0}
                    step="any"
                    value={row.amount}
                    onChange={(e) =>
                      setBasket((b) =>
                        b.map((x) =>
                          x.item.item_id === row.item.item_id
                            ? { ...x, amount: e.target.value }
                            : x,
                        ),
                      )
                    }
                    aria-label={`Quantity of ${row.item.name}`}
                  />
                  <button
                    className="btn btn-ghost size-11 min-h-11 px-0 text-lg"
                    onClick={() =>
                      setBasket((b) =>
                        b.map((x) =>
                          x.item.item_id === row.item.item_id
                            ? { ...x, amount: String((Number(x.amount) || 0) + 1) }
                            : x,
                        ),
                      )
                    }
                    aria-label="One more"
                  >
                    +
                  </button>
                  <span className="text-sm text-ink-400">
                    {usesPacks(row.item) ? `${row.item.pack_label}s` : row.item.unit}
                  </span>
                </div>

                {usesPacks(row.item) && Number(row.amount) > 0 && (
                  <p className="text-xs text-ink-600 tabular">
                    = {toBase(row).toLocaleString('en-IN')} {row.item.unit}
                  </p>
                )}

                {short && (
                  <p className="text-xs text-warn-500">
                    More than the {formatPacks(row.item.qty_available, row.item)} on record.
                    You can still take it — the count may just be behind.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-sm text-bad-500">{error}</p>}

      {basket.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 p-3 bg-ink-950/95 backdrop-blur border-t border-ink-800">
          <button
            className="btn btn-primary w-full"
            onClick={() => void post()}
            disabled={busy}
          >
            {busy
              ? 'Saving…'
              : `Take out ${basket.length} item${basket.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  )
}
