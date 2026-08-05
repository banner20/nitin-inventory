import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchAllOpenBalances } from '@/lib/queries'
import { IconIn, IconOut } from '@/components/icons'
import { EmptyState, ErrorText, Loading } from '@/components/ui'
import { formatQty, type OpenBalance } from '@/lib/types'

/**
 * "What's checked out right now?" — everyone's, not just yours. Nothing
 * about who has the company's gear is hidden from anyone on the crew.
 */
export default function CrewHome() {
  const { data, error, loading } = useAsync(fetchAllOpenBalances, [])

  const balances = data ?? []
  // Count distinct things, not quantities: adding 3000 ml of gin to 5 limes
  // gives a number that means nothing.
  const totalItems = balances.length
  const overdue = balances.filter((b) => b.overdue)

  // Group by event, most recently created first — the job someone is
  // mid-way through right now, not whichever sorts first alphabetically.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          to="/out"
          label="Take out"
          hint="Load for a job"
          Icon={IconOut}
          tone="brand"
        />
        <ActionCard
          to="/in"
          label="Bring back"
          hint="Return or log an issue"
          Icon={IconIn}
          tone="good"
        />
      </div>

      {overdue.length > 0 && (
        <div className="rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5">
          <p className="text-sm text-warn-700">
            <span className="font-semibold">{overdue.length}</span> line
            {overdue.length === 1 ? ' is' : 's are'} past the event end date.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Checked out right now</h2>
          {!loading && (
            <span className="text-xs text-fg-subtle tabular">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading && <Loading />}

        {error && <ErrorText>Couldn’t load open items. {error.message}</ErrorText>}

        {!loading && !error && balances.length === 0 && (
          <EmptyState
            title="Nothing checked out"
            hint="When someone loads stock for a job it'll show up here, with their name on it."
          />
        )}

        {events.map(([eventId, lines]) => (
          <EventGroup key={eventId} lines={lines} />
        ))}

        <Link
          to="/history"
          className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700 py-2"
        >
          See full history →
        </Link>
      </section>
    </div>
  )
}

/** The two things this app exists to do, given the size they deserve. */
function ActionCard({
  to,
  label,
  hint,
  Icon,
  tone,
}: {
  to: string
  label: string
  hint: string
  Icon: typeof IconOut
  tone: 'brand' | 'good'
}) {
  const iconClass =
    tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-good-50 text-good-600'

  return (
    <Link
      to={to}
      className="card p-4 flex flex-col gap-2.5 hover:border-line-strong hover:shadow-pop transition-all"
    >
      <span className={`size-10 rounded-lg grid place-items-center ${iconClass}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-sm">{label}</span>
        <span className="block text-xs text-fg-subtle">{hint}</span>
      </span>
    </Link>
  )
}

function EventGroup({ lines }: { lines: OpenBalance[] }) {
  const [open, setOpen] = useState(false)
  const first = lines[0]
  if (!first) return null

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-3 flex items-center justify-between gap-3 text-left hover:bg-surface-hover transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{first.event_name}</p>
          <p className="text-xs text-fg-subtle">
            {lines.length} item{lines.length === 1 ? '' : 's'} · Due{' '}
            {new Date(first.ends_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {first.overdue && <span className="badge badge-warn">Overdue</span>}
          <svg
            viewBox="0 0 24 24"
            className={`size-4 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`}
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
        <ul className="divide-y divide-line border-t border-line">
          {lines.map((line) => (
            <li
              key={`${line.item_id}-${line.person_id}`}
              className="px-3 py-2 flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">{line.item_name}</p>
                <p className="text-xs text-fg-subtle truncate">{line.person_name}</p>
              </div>
              <span
                className="tabular text-fg-muted shrink-0"
                title={`${line.outstanding} ${line.unit}`}
              >
                {formatQty(line.outstanding, line)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
