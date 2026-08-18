import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { amendTxn, fetchTxnHistory, voidTxn } from '@/lib/queries'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatPacks } from '@/lib/types'
import type { TxnHistoryEntry, TxnType } from '@/lib/types'

const PAGE_SIZE = 30

const TYPE_LABEL: Record<TxnType, string> = {
  OUT: 'Took out',
  IN: 'Brought back',
  ADD: 'Stock in',
  WRITEOFF: 'Written off',
  REPAIR: 'Repaired',
}

const TYPE_COLOR: Record<TxnType, string> = {
  OUT: 'text-brand-600',
  IN: 'text-good-600',
  ADD: 'text-good-600',
  WRITEOFF: 'text-bad-600',
  REPAIR: 'text-warn-600',
}

const CONDITION_LABEL: Record<string, string> = {
  ok: 'returned',
  consumed: 'served',
  wasted: 'spilled',
  damaged: 'broken',
  lost: 'missing',
}

/**
 * Every stock action, with who did it. The audit trail the append-only
 * ledger was built to provide — this is just a readable window onto it.
 */
export default function History() {
  const [entries, setEntries] = useState<TxnHistoryEntry[]>([])
  const [type, setType] = useState<TxnType | ''>('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Typing shouldn't fire a query per keystroke, and shouldn't reset the list
  // to page zero on every one either.
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setEntries([])
    setPage(0)
    setHasMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, debouncedQ])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTxnHistory(page * PAGE_SIZE, PAGE_SIZE, type || undefined, debouncedQ || undefined)
      .then((rows) => {
        if (cancelled) return
        setEntries((prev) => (page === 0 ? rows : [...prev, ...rows]))
        setHasMore(rows.length === PAGE_SIZE)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, type, debouncedQ, reloadNonce])

  const needle = debouncedQ.toLowerCase()
  const visible = entries

  return (
    <div className="space-y-5 max-w-4xl">
      <header>
        <h1 className="text-lg font-semibold">History</h1>
        <p className="text-sm text-fg-muted">
          Every stock action, newest first — who took what, brought what back, and what was
          bought or written off.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          className="input w-auto flex-1 min-w-56"
          placeholder="Search by person, item or event…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-auto"
          value={type}
          onChange={(e) => setType(e.target.value as TxnType | '')}
        >
          <option value="">Every action</option>
          <option value="OUT">Took out</option>
          <option value="IN">Brought back</option>
          <option value="ADD">Stock in</option>
          <option value="WRITEOFF">Written off</option>
          <option value="REPAIR">Repaired</option>
        </select>
      </div>

      {error && <p className="text-sm text-bad-600">{error}</p>}

      {visible.length === 0 && !loading && (
        <div className="card p-6 text-center text-sm text-fg-muted">
          {needle ? 'Nothing matches that search.' : 'No stock actions recorded yet.'}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((entry) => (
            <HistoryRow
              key={entry.txn_id}
              entry={entry}
              onVoided={() => {
                // Re-read from page zero: withdrawing an entry changes what
                // every later balance says.
                setEntries([])
                setPage(0)
                setReloadNonce((n) => n + 1)
              }}
            />
          ))}
        </ul>
      )}

      {loading && <p className="text-sm text-fg-muted">Loading…</p>}

      {/* Available while searching too — the search now runs across every
          record, so there really is more to load. */}
      {!loading && hasMore && (
        <button className="btn btn-ghost w-full" onClick={() => setPage((p) => p + 1)}>
          Load more
        </button>
      )}
    </div>
  )
}

function HistoryRow({
  entry,
  onVoided,
}: {
  entry: TxnHistoryEntry
  onVoided: () => void
}) {
  const { profile, isManager } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The quantities as typed, in the item's own pack, keyed by line index. */
  const [draft, setDraft] = useState<Record<number, string>>({})

  const who = entry.actor_name
    ? `${entry.actor_name}${entry.actor_emp_code ? ` (${entry.actor_emp_code})` : ''}`
    : 'Someone'
  const forWhom =
    entry.person_name && entry.person_name !== entry.actor_name ? entry.person_name : null

  const voided = entry.status === 'void'
  // Your own slip is yours to fix; someone else's is a manager's call. The
  // database enforces this too — this only decides whether to offer it.
  const canUndo = !voided && (isManager || entry.created_by === profile?.id)
  const lines = entry.lines ?? []

  /** Pack-size helper: quantities are stored in base units but read and typed
   * in whole bottles, same as everywhere else. */
  const sizeOf = (l: (typeof lines)[number]) =>
    l.pack_label && Number(l.pack_size) > 1 ? Number(l.pack_size) : 1

  function startEditing() {
    setDraft(
      Object.fromEntries(
        lines.map((l, i) => [i, String(Number((Number(l.qty) / sizeOf(l)).toFixed(3)))]),
      ),
    )
    setError(null)
    setEditing(true)
  }

  async function saveEdit() {
    setBusy(true)
    setError(null)
    try {
      const next = lines
        .map((l, i) => ({
          item_id: l.item_id,
          qty: Number((Number(draft[i] ?? 0) * sizeOf(l)).toFixed(3)),
          condition: l.condition,
          from_loose: l.from_loose,
        }))
        // A line dropped to zero is a line removed. All of them at zero means
        // the entry shouldn't exist — undo it instead, which the DB enforces.
        .filter((l) => l.qty > 0)

      if (next.length === 0) {
        throw new Error('Everything is zero — use "Undo this entry" instead.')
      }

      await amendTxn(entry.txn_id, next, reason)
      setEditing(false)
      onVoided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    setBusy(true)
    setError(null)
    try {
      await voidTxn(entry.txn_id, reason)
      setConfirming(false)
      onVoided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={clsx('card p-4 space-y-2', voided && 'bg-surface-alt border-dashed')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={clsx('text-sm', voided && 'line-through decoration-fg-subtle')}>
          <span
            className={clsx(
              'font-semibold',
              voided ? 'text-fg-subtle' : TYPE_COLOR[entry.type],
            )}
          >
            {TYPE_LABEL[entry.type]}
          </span>{' '}
          <span className="text-fg-muted">
            · {who}
            {forWhom && ` on behalf of ${forWhom}`}
            {entry.event_name && ` · ${entry.event_name}`}
          </span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {voided && <span className="badge badge-neutral">withdrawn</span>}
          <time className="text-xs text-fg-subtle">
            {new Date(entry.occurred_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </time>
        </div>
      </div>

      {/* The entry is never edited, so say plainly that it no longer counts
          and who decided that. */}
      {voided && (
        <p className="text-xs text-fg-subtle">
          Withdrawn{entry.voided_by_name ? ` by ${entry.voided_by_name}` : ''}
          {entry.voided_at &&
            ` on ${new Date(entry.voided_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}`}
          {entry.void_reason && ` — “${entry.void_reason}”`}. It no longer counts
          towards any total.
        </p>
      )}

      {entry.replaces_txn_id && (
        <p className="text-xs text-good-700">Corrects an earlier entry.</p>
      )}

      {entry.note && <p className="text-sm text-fg-muted italic">“{entry.note}”</p>}

      {lines.length > 0 && (
        <ul className="text-sm divide-y divide-line border-t border-line -mx-4 px-4">
          {lines.map((line, i) => (
            <li key={i} className="py-1.5 flex items-center justify-between gap-3">
              <span className="text-sm truncate">{line.item_name}</span>
              {editing ? (
                /* Typed in whole bottles, like everywhere else; converted back
                   to base units on save. Zero drops the line. */
                <span className="flex items-center gap-2 shrink-0">
                  <input
                    className="input tabular text-center w-20 h-9 min-h-9"
                    type="number"
                    min={0}
                    step="any"
                    value={draft[i] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [i]: e.target.value }))}
                    aria-label={`Amount of ${line.item_name}`}
                  />
                  <span className="text-xs text-fg-muted w-16">
                    {line.pack_label && Number(line.pack_size) > 1
                      ? `${line.pack_label}s`
                      : line.unit}
                  </span>
                </span>
              ) : (
                <span className="text-fg-muted tabular shrink-0 flex items-center gap-2">
                  {formatPacks(line.qty, line)}
                  {line.condition && line.condition !== 'ok' && (
                    <span className="text-xs text-warn-600">
                      {CONDITION_LABEL[line.condition] ?? line.condition}
                    </span>
                  )}
                  {line.vendor && <span className="text-xs text-fg-subtle">· {line.vendor}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUndo && editing && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2">
          <p className="text-sm text-brand-700">
            Change the amounts above, then save. The original stays in the history marked
            as corrected — nothing is rewritten.
          </p>
          <input
            className="input h-9 min-h-9 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was wrong with it? (optional)"
          />
          {error && <p className="text-xs text-bad-600">{error}</p>}
          <div className="flex gap-2">
            <button
              className="btn btn-primary h-9 min-h-9 text-sm px-3"
              onClick={() => void saveEdit()}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save correction'}
            </button>
            <button
              className="btn btn-ghost h-9 min-h-9 text-sm px-3"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {canUndo && !editing && (
        <div className="pt-1">
          {confirming ? (
            <div className="rounded-lg border border-warn-200 bg-warn-50 p-3 space-y-2">
              <p className="text-sm text-warn-700">
                Undo this? It stays in the history, struck through, and stops counting —
                whatever it moved goes back to where it was, ready to be recorded again
                correctly.
              </p>
              <input
                className="input h-9 min-h-9 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What was wrong with it? (optional)"
                autoFocus
              />
              {error && <p className="text-xs text-bad-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  className="btn btn-primary h-9 min-h-9 text-sm px-3"
                  onClick={() => void undo()}
                  disabled={busy}
                >
                  {busy ? 'Undoing…' : 'Yes, undo it'}
                </button>
                <button
                  className="btn btn-ghost h-9 min-h-9 text-sm px-3"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
                onClick={startEditing}
              >
                Edit amounts
              </button>
              <button
                className="text-xs font-medium text-fg-muted hover:text-bad-600"
                onClick={() => setConfirming(true)}
              >
                Undo this entry
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
