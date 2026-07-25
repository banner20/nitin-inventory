import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { fetchMyOpenBalances } from '@/lib/queries'
import { IconIn, IconOut } from '@/components/icons'
import { formatPacks } from '@/lib/types'

/**
 * "What am I still holding?" — the question the whole app exists to answer,
 * so it is the first thing on the screen.
 */
export default function CrewHome() {
  const { profile } = useAuth()
  const personId = profile?.id
  const { data, error, loading } = useAsync(
    () => (personId ? fetchMyOpenBalances(personId) : Promise.resolve([])),
    [personId],
  )

  const balances = data ?? []
  // Count distinct things, not quantities: adding 3000 ml of gin to 5 limes
  // gives a number that means nothing.
  const totalItems = balances.length
  const overdue = balances.filter((b) => b.overdue)

  // Group by event so it reads like "this job, these things".
  const byEvent = new Map<string, typeof balances>()
  for (const b of balances) {
    const list = byEvent.get(b.event_id) ?? []
    list.push(b)
    byEvent.set(b.event_id, list)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Link to="/out" className="card p-4 flex flex-col items-center gap-2 hover:border-brand-500 transition-colors">
          <IconOut className="size-7 text-brand-400" />
          <span className="font-semibold text-white">Take out</span>
        </Link>
        <Link to="/in" className="card p-4 flex flex-col items-center gap-2 hover:border-brand-500 transition-colors">
          <IconIn className="size-7 text-good-500" />
          <span className="font-semibold text-white">Bring back</span>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-white">With you right now</h2>
          {!loading && (
            <span className="text-sm text-ink-400 tabular">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-ink-400">Loading…</p>}

        {error && (
          <p className="text-sm text-bad-500">
            Couldn’t load your items. {error.message}
          </p>
        )}

        {!loading && !error && balances.length === 0 && (
          <div className="card p-5 text-center">
            <p className="text-sm text-ink-400">
              Nothing signed out to you. You’re all clear.
            </p>
          </div>
        )}

        {overdue.length > 0 && (
          <p className="text-sm text-warn-500">
            {overdue.length} line{overdue.length === 1 ? ' is' : 's are'} past the event
            end date.
          </p>
        )}

        {[...byEvent.entries()].map(([eventId, lines]) => {
          const first = lines[0]
          if (!first) return null
          return (
            <div key={eventId} className="card divide-y divide-ink-800">
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{first.event_name}</p>
                  <p className="text-xs text-ink-400">
                    Due {new Date(first.ends_at).toLocaleDateString()}
                  </p>
                </div>
                {first.overdue && (
                  <span className="text-xs font-semibold text-warn-500 shrink-0">Overdue</span>
                )}
              </div>
              <ul className="divide-y divide-ink-800">
                {lines.map((line) => (
                  <li key={line.item_id} className="px-3 py-2 flex justify-between gap-3 text-sm">
                    <span className="text-ink-200 truncate">{line.item_name}</span>
                    <span
                      className="tabular text-ink-400 shrink-0"
                      title={`${line.outstanding} ${line.unit}`}
                    >
                      {formatPacks(line.outstanding, line)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
