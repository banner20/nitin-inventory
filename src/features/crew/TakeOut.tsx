import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability } from '@/lib/queries'
import { createEvent, fetchActiveEvents } from '@/lib/events'
import { createItem, postTxn, type PostLine } from '@/lib/txns'
import {
  AmountInput,
  amountToBase,
  defaultMode,
  type AmountMode,
} from '@/components/AmountInput'
import {
  formatQty,
  itemMatches,
  toItemAvailability,
  type EventRecord,
  type ItemAvailability,
} from '@/lib/types'
import { buildVoiceVocabulary, parseVoiceTranscript, useVoiceRecorder } from '@/lib/voice'

interface BasketRow {
  item: ItemAvailability
  amount: string
  mode: AmountMode
  /** Separate from `amount` — drawn from the item's already-opened bottle
   * rather than a fresh sealed pack, so both can be taken in the same line-up
   * (e.g. two full bottles plus what's left in the one already open). */
  looseAmount: string
}

function sealedBase(row: BasketRow): number {
  return amountToBase(row.amount, row.mode, row.item)
}

function looseBase(row: BasketRow): number {
  return Number(row.looseAmount) || 0
}

function toBase(row: BasketRow): number {
  return sealedBase(row) + looseBase(row)
}

/**
 * Signing stock out to an event. Two steps — pick the job, then fill the van —
 * because "which event is this for" is the one thing that must never be
 * guessed.
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
  const [quickAdding, setQuickAdding] = useState(false)
  const [quickAddError, setQuickAddError] = useState<string | null>(null)
  const voice = useVoiceRecorder()
  const [voiceResult, setVoiceResult] = useState<{ heard: string; unmatched: string[] } | null>(null)

  const chosen = new Set(basket.map((b) => b.item.item_id))

  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? [])
      .filter((i) => itemMatches(i, q) && !chosen.has(i.item_id))
      .slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, basket])

  function patch(id: string, next: Partial<BasketRow>) {
    setBasket((b) => b.map((x) => (x.item.item_id === id ? { ...x, ...next } : x)))
  }

  /**
   * Something the master sheet has never heard of, reached for mid-service.
   * Creates it with the barest defaults so the take-out isn't blocked — a
   * manager fills in category, pack size and kind properly afterwards from
   * the master sheet's Edit button.
   */
  async function quickAdd(name: string) {
    setQuickAdding(true)
    setQuickAddError(null)
    try {
      const created = await createItem({
        name,
        categoryId: null,
        unit: 'pcs',
        minStock: 0,
        kind: 'consumable',
        aliases: [],
      })
      const withStock = toItemAvailability(created, [])
      setBasket((b) => [...b, { item: withStock, amount: '1', mode: defaultMode(withStock), looseAmount: '' }])
      setQ('')
      items.reload()
    } catch (err) {
      setQuickAddError(err instanceof Error ? err.message : 'Could not add the item.')
    } finally {
      setQuickAdding(false)
    }
  }

  /** Stop recording, transcribe, and drop whatever was heard into the basket
   * for review — quantities read back from natural speech are a best
   * guess, not a submission, so nothing posts until the crew member checks it. */
  async function handleVoiceStop() {
    const text = await voice.stopAndTranscribe(buildVoiceVocabulary(items.data ?? []))
    if (!text) return

    const { matched, unmatched } = parseVoiceTranscript(text, items.data ?? [])
    setBasket((b) => {
      const next = [...b]
      for (const m of matched) {
        const existingIdx = next.findIndex((x) => x.item.item_id === m.item.item_id)
        if (existingIdx >= 0) {
          const existing = next[existingIdx]!
          const currentQty = Number(existing.amount) || 0
          next[existingIdx] = { ...existing, amount: String(currentQty + m.qty) }
        } else {
          next.push({ item: m.item, amount: String(m.qty), mode: defaultMode(m.item), looseAmount: '' })
        }
      }
      return next
    })
    setVoiceResult({ heard: text, unmatched: unmatched.map((u) => u.heard) })
  }

  async function post() {
    if (!event || !profile) return
    setBusy(true)
    setError(null)
    try {
      const lines: PostLine[] = []
      for (const b of basket) {
        const sealed = sealedBase(b)
        const loose = looseBase(b)
        if (sealed > 0) lines.push({ item_id: b.item.item_id, qty: sealed })
        if (loose > 0) lines.push({ item_id: b.item.item_id, qty: loose, from_loose: true })
      }

      if (lines.length === 0) throw new Error('Add something first.')

      await postTxn({ type: 'OUT', lines, eventId: event.id, personId: profile.id })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  // ---- step 1: which job? --------------------------------------------------
  if (!event) {
    return (
      <EventStep
        events={events.data ?? []}
        loading={events.loading}
        error={events.error}
        onPick={setEvent}
        onCreated={(e) => {
          events.reload()
          setEvent(e)
        }}
      />
    )
  }

  // ---- step 2: fill the van ------------------------------------------------
  return (
    <div className="space-y-4 pb-28">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">Taking out for</p>
          <h1 className="font-semibold text-fg truncate">{event.name}</h1>
        </div>
        <button className="btn btn-ghost h-9 min-h-9 text-sm px-3" onClick={() => setEvent(null)}>
          Change
        </button>
      </header>

      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — gin, tonic, jigger…"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className={
            'shrink-0 size-11 min-h-11 rounded-lg flex items-center justify-center transition-colors ' +
            (voice.recording
              ? 'bg-bad-600 text-white animate-pulse'
              : 'btn btn-ghost px-0')
          }
          onClick={() => (voice.recording ? void handleVoiceStop() : void voice.start())}
          disabled={voice.busy}
          aria-label={voice.recording ? 'Stop listening' : 'Add items by voice'}
          title={voice.recording ? 'Stop listening' : 'Add items by voice'}
        >
          {voice.busy ? (
            <span className="text-xs">…</span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {voice.error && <p className="text-sm text-bad-600">{voice.error}</p>}

      {voiceResult && (
        <div className="card p-3 space-y-1.5 text-sm">
          <p className="text-fg-muted">
            Heard: <span className="text-fg">“{voiceResult.heard}”</span>
          </p>
          {voiceResult.unmatched.length > 0 && (
            <p className="text-warn-600">
              Couldn't match: {voiceResult.unmatched.join(', ')} — add these by search instead.
            </p>
          )}
          <button
            className="text-xs text-brand-600 underline"
            onClick={() => setVoiceResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {matches.length > 0 && (
        <ul className="card divide-y divide-line">
          {matches.map((m) => (
            <li key={m.item_id}>
              <button
                className="w-full text-left px-3 py-3 hover:bg-surface-hover flex justify-between gap-3 items-center"
                onClick={() => {
                  setBasket((b) => [...b, { item: m, amount: '1', mode: defaultMode(m), looseAmount: '' }])
                  setQ('')
                }}
              >
                <span className="min-w-0">
                  <span className="block text-fg truncate">{m.name}</span>
                  <span className="block text-xs text-fg-subtle">
                    {formatQty(m.qty_available, m)} available
                  </span>
                </span>
                <span className="text-brand-600 text-xl shrink-0">+</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim() && matches.length === 0 && (
        <div className="card p-3 space-y-2">
          <p className="text-sm text-fg-muted">
            Nothing matches “{q.trim()}” — not on the master sheet yet.
          </p>
          <button
            className="btn btn-ghost w-full"
            onClick={() => void quickAdd(q.trim())}
            disabled={quickAdding}
          >
            {quickAdding ? 'Adding…' : `Quick add "${q.trim()}" and take it out`}
          </button>
          <p className="text-xs text-fg-subtle">
            A manager can fill in its category and pack size later from the master sheet.
          </p>
          {quickAddError && <p className="text-xs text-bad-600">{quickAddError}</p>}
        </div>
      )}

      {basket.length === 0 ? (
        <div className="card p-6 text-center text-sm text-fg-muted">
          Search above to start loading.
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {basket.map((row) => {
            const short = toBase(row) > Number(row.item.qty_available)
            return (
              <li key={row.item.item_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{row.item.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {formatQty(row.item.qty_available, row.item)} available
                    </p>
                  </div>
                  <button
                    className="text-fg-subtle hover:text-bad-600 px-2"
                    onClick={() =>
                      setBasket((b) => b.filter((x) => x.item.item_id !== row.item.item_id))
                    }
                    aria-label={`Remove ${row.item.name}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-fg-muted">Full bottles</span>
                  <AmountInput
                    item={row.item}
                    amount={row.amount}
                    mode={row.mode}
                    withSteppers
                    ariaLabel={`Full bottles of ${row.item.name}`}
                    onChange={(amount, mode) => patch(row.item.item_id, { amount, mode })}
                  />
                </div>

                {Number(row.item.qty_loose) > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-fg-muted">
                        Plus loose ({formatQty(row.item.qty_loose, row.item)} left)
                      </span>
                      <button
                        type="button"
                        className="text-xs text-brand-600 underline"
                        onClick={() =>
                          patch(row.item.item_id, {
                            looseAmount: String(Number(row.item.qty_loose)),
                          })
                        }
                      >
                        All the loose
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="input tabular text-center w-24"
                        type="number"
                        min={0}
                        max={Number(row.item.qty_loose)}
                        step="any"
                        inputMode="decimal"
                        value={row.looseAmount}
                        onChange={(e) => {
                          const capped = Math.min(
                            Number(e.target.value) || 0,
                            Number(row.item.qty_loose),
                          )
                          patch(row.item.item_id, {
                            looseAmount: e.target.value === '' ? '' : String(capped),
                          })
                        }}
                        aria-label={`Loose amount of ${row.item.name}`}
                      />
                      <span className="text-sm text-fg-muted">{row.item.unit}</span>
                    </div>
                  </div>
                )}

                {short && (
                  <p className="text-xs text-warn-600">
                    More than the {formatQty(row.item.qty_available, row.item)} on record.
                    You can still take it — the count may just be behind.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-sm text-bad-600">{error}</p>}

      {basket.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 p-3 bg-surface/95 backdrop-blur border-t border-line">
          <button className="btn btn-primary w-full" onClick={() => void post()} disabled={busy}>
            {busy ? 'Saving…' : `Take out ${basket.length} item${basket.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  )
}

function EventStep({
  events,
  loading,
  error,
  onPick,
  onCreated,
}: {
  events: EventRecord[]
  loading: boolean
  error: Error | null
  onPick: (e: EventRecord) => void
  onCreated: (e: EventRecord) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Taking stock out</h1>
        <p className="text-sm text-fg-muted">Which event is this for?</p>
      </header>

      {loading && <p className="text-sm text-fg-muted">Loading…</p>}
      {error && <p className="text-sm text-bad-600">{error.message}</p>}

      {!loading && events.length === 0 && !adding && (
        <div className="card p-5 text-center text-sm text-fg-muted">
          No events are open. Create one below to get loading.
        </div>
      )}

      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id}>
            <button
              className="card w-full text-left p-4 hover:border-brand-500 transition-colors"
              onClick={() => onPick(e)}
            >
              <p className="font-medium text-fg">{e.name}</p>
              <p className="text-sm text-fg-muted">
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

      {adding ? (
        <QuickEventForm onCreated={onCreated} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn btn-ghost w-full" onClick={() => setAdding(true)}>
          + New event
        </button>
      )}
    </div>
  )
}

/**
 * Deliberately just a name and a finish time. Anything more is admin, and the
 * person standing next to a loaded van shouldn't be doing admin — a manager can
 * fill in the client and venue afterwards.
 */
function QuickEventForm({
  onCreated,
  onCancel,
}: {
  onCreated: (e: EventRecord) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [days, setDays] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const now = new Date()
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      const created = await createEvent({
        name,
        startsAt: now.toISOString(),
        endsAt: end.toISOString(),
      })
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold">New event</h2>

      <label className="space-y-1.5 block">
        <span className="text-sm text-fg-muted">What's the job?</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sharma sangeet — Taj"
          autoFocus
          required
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-sm text-fg-muted">Back by</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { d: 1, label: 'Tomorrow' },
            { d: 2, label: '2 days' },
            { d: 4, label: '4 days' },
          ].map((o) => (
            <button
              key={o.d}
              type="button"
              onClick={() => setDays(o.d)}
              className={
                'btn ' + (days === o.d ? 'btn-primary' : 'btn-ghost')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-subtle">
          This is only what makes stock show as overdue — a manager can change it.
        </p>
      </div>

      {error && <p className="text-sm text-bad-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create and load'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
