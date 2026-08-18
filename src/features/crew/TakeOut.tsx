import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { useIdempotencyKey } from '@/lib/useIdempotencyKey'
import { usePersistentState } from '@/lib/usePersistentState'
import { fetchItemAvailability, findTxnByClientUuid } from '@/lib/queries'
import { createEvent, fetchActiveEvents } from '@/lib/events'
import { createItem, postTxn, type PostLine } from '@/lib/txns'
import {
  AmountInput,
  amountToBase,
  defaultMode,
  packOptions,
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
  /** Identifies the row, not the item — a van can take the same syrup as two
   * 700ml bottles and a 500ml one, and those are two lines. */
  key: string
  item: ItemAvailability
  amount: string
  mode: AmountMode
  /** Separate from `amount` — drawn from the item's already-opened bottle
   * rather than a fresh sealed pack, so both can be taken in the same line-up
   * (e.g. two full bottles plus what's left in the one already open). */
  looseAmount: string
}

let rowSeq = 0
function nextKey(): string {
  return `row-${++rowSeq}`
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

  // Both survive a reload: ten minutes of loading a van shouldn't be undone by
  // a phone killing the tab, or by a save that failed with no signal.
  const [event, setEvent, clearEvent] = usePersistentState<EventRecord | null>(
    'takeout.event',
    null,
  )
  const [q, setQ] = useState('')
  const [basket, setBasket, clearBasket] = usePersistentState<BasketRow[]>('takeout.basket', [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quickAdding, setQuickAdding] = useState(false)
  const [quickAddError, setQuickAddError] = useState<string | null>(null)
  /** Reassurance after a dropped connection turned out to have saved anyway. */
  const [settled, setSettled] = useState<string | null>(null)
  // Stored, because the basket it belongs to is stored too.
  const idem = useIdempotencyKey('takeout.idempotency')
  const voice = useVoiceRecorder()
  const [voiceResult, setVoiceResult] = useState<{ heard: string; unmatched: string[] } | null>(null)

  /**
   * Settle any attempt left hanging by a lost connection.
   *
   * If a key survived from last time, the previous save either never reached
   * the server or reached it and the reply was lost on the way back. Asking
   * the ledger settles it: if that transaction exists the stock is already
   * signed out, so the basket is cleared and the crew told — rather than left
   * looking at a full van they're tempted to save a second time.
   */
  useEffect(() => {
    const key = idem.pending()
    if (!key || basket.length === 0) return
    let cancelled = false

    findTxnByClientUuid(key).then((txnId) => {
      if (cancelled || !txnId) return
      idem.reset()
      clearBasket()
      clearEvent()
      setBasket([])
      setEvent(null)
      setSettled('That load had already saved — the connection just dropped before it could say so.')
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * A saved event can go stale — closed by a manager, or deleted outright
   * during a stocktake. Posting against one fails deep in the database with a
   * foreign-key error nobody can act on, so it's checked here instead: if the
   * job is no longer open, say so and send them back to pick a live one. The
   * basket is deliberately kept, since the stock in the van is still real.
   */
  useEffect(() => {
    if (!event || !events.data) return
    const live = events.data.find((e) => e.id === event.id)
    if (live) {
      // Also refresh it, in case the name or return date moved on.
      if (live.name !== event.name || live.ends_at !== event.ends_at) setEvent(live)
      return
    }
    setEvent(null)
    setError(
      `“${event.name}” is no longer open, so what you'd loaded couldn't stay attached to it. Pick the job again — your items are still here.`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.data])

  /**
   * A saved basket carries a copy of each item as it looked when it was added,
   * so a basket reopened the next morning would show yesterday's "5 bottles
   * available" beside today's stock. The quantities typed in are the crew's
   * and stay untouched; everything read off the item — what's available, how
   * it's packed — is refreshed from the server the moment it arrives.
   */
  useEffect(() => {
    if (!items.data || basket.length === 0) return
    setBasket((rows) => {
      let changed = false
      const next = rows.map((row) => {
        const fresh = items.data!.find((i) => i.item_id === row.item.item_id)
        if (!fresh || fresh === row.item) return row
        changed = true
        return { ...row, item: fresh }
      })
      return changed ? next : rows
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data])

  /** Which size of which item is already loaded — keyed by both, so the same
   * item can be taken in more than one size. */
  const chosen = new Set(basket.map((b) => `${b.item.item_id}:${b.mode}`))

  // An item stays searchable while it still has a size that isn't loaded.
  const matches = useMemo(() => {
    if (!q.trim()) return []
    return (items.data ?? [])
      .filter((i) => {
        if (!itemMatches(i, q)) return false
        const sizes = [...packOptions(i).map((o) => o.id), 'base']
        return sizes.some((s) => !chosen.has(`${i.item_id}:${s}`))
      })
      .slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items.data, basket])

  /** Load an item, landing on a size that isn't already in the basket. */
  function addToBasket(item: ItemAvailability) {
    const sizes = [...packOptions(item).map((o) => o.id), 'base']
    const mode =
      sizes.find((s) => !chosen.has(`${item.item_id}:${s}`)) ?? defaultMode(item)
    setBasket((b) => [
      ...b,
      { key: nextKey(), item, amount: '1', mode, looseAmount: '' },
    ])
    setQ('')
  }

  function patch(key: string, next: Partial<BasketRow>) {
    setBasket((b) => b.map((x) => (x.key === key ? { ...x, ...next } : x)))
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
        // Everything above except the name is a placeholder. Flagging it means
        // the master sheet asks a manager to finish the job rather than the
        // stub blending in and quietly counting itself wrong.
        needsReview: true,
      })
      const withStock = toItemAvailability(created, [])
      setBasket((b) => [
        ...b,
        { key: nextKey(), item: withStock, amount: '1', mode: defaultMode(withStock), looseAmount: '' },
      ])
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
          next.push({
            key: nextKey(),
            item: m.item,
            amount: String(m.qty),
            mode: defaultMode(m.item),
            looseAmount: '',
          })
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
        // pack_id records which size left the store, and is also what keeps
        // two sizes of the same item from colliding as one line.
        const packId = (b.item.alt_packs ?? []).some((p) => p.id === b.mode)
          ? b.mode
          : 'default'
        if (sealed > 0) lines.push({ item_id: b.item.item_id, qty: sealed, pack_id: packId })
        if (loose > 0) {
          lines.push({ item_id: b.item.item_id, qty: loose, from_loose: true })
        }
      }

      if (lines.length === 0) throw new Error('Add something first.')

      await postTxn({
        type: 'OUT',
        lines,
        eventId: event.id,
        personId: profile.id,
        clientUuid: idem.current(),
      })
      idem.reset()
      // Saved for real — the draft has done its job.
      clearBasket()
      clearEvent()
      setBasket([])
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
        /* Whatever sent them back here — a job that closed, or a save that
           had already gone through — has to be readable on this screen, not
           the one they were bounced off. */
        notice={settled}
        warning={error}
        basketCount={basket.length}
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

      {settled && (
        <div className="rounded-lg border border-good-200 bg-good-50 px-3 py-2.5 flex items-start justify-between gap-3">
          <p className="text-sm text-good-700">{settled}</p>
          <button
            className="text-xs font-medium text-good-700 shrink-0"
            onClick={() => setSettled(null)}
          >
            OK
          </button>
        </div>
      )}

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
                  addToBasket(m)
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
              <li key={row.key} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate flex items-center gap-2">
                      {row.item.name}
                      {/* When the same item is loaded in two sizes, say which
                          each row is — otherwise they're indistinguishable. */}
                      {basket.filter((x) => x.item.item_id === row.item.item_id).length > 1 && (
                        <span className="badge badge-brand">
                          {packOptions(row.item).find((o) => o.id === row.mode)?.label ??
                            row.item.unit}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {formatQty(row.item.qty_available, row.item)} available
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Taking the same thing in two sizes is normal — two
                        700ml bottles and a 500ml one — so it's a tap here
                        rather than a second search. */}
                    {packOptions(row.item).length > 1 && (
                      <button
                        type="button"
                        className="btn btn-quiet h-8 min-h-8 text-xs px-2"
                        onClick={() => addToBasket(row.item)}
                        title="Take another size of this item too"
                      >
                        + size
                      </button>
                    )}
                    <button
                      className="text-fg-subtle hover:text-bad-600 px-2"
                      onClick={() => setBasket((b) => b.filter((x) => x.key !== row.key))}
                      aria-label={`Remove ${row.item.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-fg-muted">Full bottles</span>
                  <AmountInput
                    item={row.item}
                    amount={row.amount}
                    mode={row.mode}
                    withSteppers
                    ariaLabel={`Full bottles of ${row.item.name}`}
                    onChange={(amount, mode) => patch(row.key, { amount, mode })}
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
                          patch(row.key, {
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
                          patch(row.key, {
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
  notice,
  warning,
  basketCount,
  onPick,
  onCreated,
}: {
  events: EventRecord[]
  loading: boolean
  error: Error | null
  notice?: string | null
  warning?: string | null
  basketCount?: number
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

      {notice && (
        <div className="rounded-lg border border-good-200 bg-good-50 px-3 py-2.5">
          <p className="text-sm text-good-700">{notice}</p>
        </div>
      )}

      {warning && (
        <div className="rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5">
          <p className="text-sm text-warn-700">{warning}</p>
        </div>
      )}

      {/* The van is still loaded even though the job it was for has gone.
          Saying so stops it looking like the basket was lost. */}
      {!warning && !notice && (basketCount ?? 0) > 0 && (
        <div className="rounded-lg border border-line bg-surface-alt px-3 py-2.5">
          <p className="text-sm text-fg-muted">
            You still have {basketCount} item{basketCount === 1 ? '' : 's'} loaded. Pick a job
            to carry on.
          </p>
        </div>
      )}

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
 * The end of a day N days from now, rather than N×24h from this moment.
 * "Back today" set at 6pm has to mean tonight, not 6pm — otherwise a job
 * created during service is overdue before the van has left.
 */
function endOfDayAfter(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(23, 59, 59, 999)
  return d
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
  // Most jobs go out and come back the same night, so that's the default.
  const [days, setDays] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const now = new Date()
      const created = await createEvent({
        name,
        startsAt: now.toISOString(),
        endsAt: endOfDayAfter(days).toISOString(),
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
        <div className="grid grid-cols-4 gap-2">
          {[
            { d: 0, label: 'Tonight' },
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
