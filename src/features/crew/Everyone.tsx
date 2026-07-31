import { useMemo, useState } from 'react'
import { useAsync } from '@/lib/useAsync'
import { fetchAllOpenBalances } from '@/lib/queries'
import { formatPacks, type OpenBalance } from '@/lib/types'

/**
 * What's checked out right now, across everyone — not just you. Nothing
 * about who has the company's gear should be hidden from the crew holding it.
 */
export default function Everyone() {
  const { data, error, loading } = useAsync(fetchAllOpenBalances, [])
  const balances = data ?? []
  const overdue = balances.filter((b) => b.overdue)

  const events = useMemo(() => {
    const map = new Map<string, OpenBalance[]>()
    for (const b of balances) {
      const list = map.get(b.event_id) ?? []
      list.push(b)
      map.set(b.event_id, list)
    }
    return [...map.entries()].sort(
      ([, a], [, b]) =>
        new Date(b[0]?.event_created_at ?? 0).getTime() -
        new Date(a[0]?.event_created_at ?? 0).getTime(),
    )
  }, [balances])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-white">Everyone's items</h1>
        <p className="text-sm text-ink-400">
          Everything currently checked out, across the whole crew.
        </p>
      </header>

      <div className="flex items-baseline justify-between">
        {!loading && (
          <span className="text-sm text-ink-400 tabular">
            {balances.length} item{balances.length === 1 ? '' : 's'} out
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}

      {error && (
        <p className="text-sm text-bad-500">Couldn't load open items. {error.message}</p>
      )}

      {!loading && !error && balances.length === 0 && (
        <div className="card p-5 text-center">
          <p className="text-sm text-ink-400">Nothing checked out right now.</p>
        </div>
      )}

      {overdue.length > 0 && (
        <p className="text-sm text-warn-500">
          {overdue.length} line{overdue.length === 1 ? ' is' : 's are'} past the event end date.
        </p>
      )}

      {events.map(([eventId, lines]) => (
        <EventGroup key={eventId} lines={lines} />
      ))}
    </div>
  )
}

function EventGroup({ lines }: { lines: OpenBalance[] }) {
  const [open, setOpen] = useState(false)
  const first = lines[0]
  if (!first) return null

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-3 flex items-center justify-between gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-medium text-white truncate">{first.event_name}</p>
          <p className="text-xs text-ink-400">
            {lines.length} item{lines.length === 1 ? '' : 's'} · Due{' '}
            {new Date(first.ends_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {first.overdue && (
            <span className="text-xs font-semibold text-warn-500">Overdue</span>
          )}
          <svg
            viewBox="0 0 24 24"
            className={`size-5 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {open && (
        <ul className="divide-y divide-ink-800 border-t border-ink-800">
          {lines.map((line) => (
            <li
              key={`${line.item_id}-${line.person_id}`}
              className="px-3 py-2 flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-ink-200 truncate">{line.item_name}</p>
                <p className="text-xs text-ink-600 truncate">{line.person_name}</p>
              </div>
              <span
                className="tabular text-ink-400 shrink-0"
                title={`${line.outstanding} ${line.unit}`}
              >
                {formatPacks(line.outstanding, line)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
