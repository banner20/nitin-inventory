import { useEffect, useState } from 'react'
import { fetchTxnHistory } from '@/lib/queries'
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

  useEffect(() => {
    setEntries([])
    setPage(0)
    setHasMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTxnHistory(page * PAGE_SIZE, PAGE_SIZE, type || undefined)
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
  }, [page, type])

  const needle = q.trim().toLowerCase()
  const visible = needle
    ? entries.filter((e) => {
        const haystack = [
          e.event_name,
          e.actor_name,
          e.actor_emp_code,
          e.person_name,
          e.person_emp_code,
          e.note,
          ...(e.lines ?? []).map((l) => l.item_name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
    : entries

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
            <HistoryRow key={entry.txn_id} entry={entry} />
          ))}
        </ul>
      )}

      {loading && <p className="text-sm text-fg-muted">Loading…</p>}

      {!loading && hasMore && !needle && (
        <button className="btn btn-ghost w-full" onClick={() => setPage((p) => p + 1)}>
          Load more
        </button>
      )}
    </div>
  )
}

function HistoryRow({ entry }: { entry: TxnHistoryEntry }) {
  const who = entry.actor_name
    ? `${entry.actor_name}${entry.actor_emp_code ? ` (${entry.actor_emp_code})` : ''}`
    : 'Someone'
  const forWhom =
    entry.person_name && entry.person_name !== entry.actor_name ? entry.person_name : null

  return (
    <li className="card p-4 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm">
          <span className={`font-semibold ${TYPE_COLOR[entry.type]}`}>
            {TYPE_LABEL[entry.type]}
          </span>{' '}
          <span className="text-fg-muted">
            · {who}
            {forWhom && ` on behalf of ${forWhom}`}
            {entry.event_name && ` · ${entry.event_name}`}
          </span>
        </p>
        <time className="text-xs text-fg-subtle shrink-0">
          {new Date(entry.occurred_at).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
      </div>

      {entry.note && <p className="text-sm text-fg-muted italic">“{entry.note}”</p>}

      {entry.lines && entry.lines.length > 0 && (
        <ul className="text-sm divide-y divide-line border-t border-line -mx-4 px-4">
          {entry.lines.map((line, i) => (
            <li key={i} className="py-1.5 flex items-center justify-between gap-3">
              <span className="text-sm truncate">{line.item_name}</span>
              <span className="text-fg-muted tabular shrink-0 flex items-center gap-2">
                {formatPacks(line.qty, line)}
                {line.condition && line.condition !== 'ok' && (
                  <span className="text-xs text-warn-600">
                    {CONDITION_LABEL[line.condition] ?? line.condition}
                  </span>
                )}
                {line.vendor && <span className="text-xs text-fg-subtle">· {line.vendor}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
