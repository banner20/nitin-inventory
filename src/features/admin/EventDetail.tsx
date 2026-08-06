import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchEvent } from '@/lib/events'
import { fetchEventCosts } from '@/lib/queries'
import { formatMoney, formatQty, type EventCostLine } from '@/lib/types'
import { EmptyState, ErrorText, Loading, PageHeader, Stat } from '@/components/ui'
import { downloadReport, summarise } from './eventReport'
import { OutcomeBar, TopItemsChart } from './EventCharts'

/**
 * What one event actually cost, on screen.
 *
 * The same figures as the downloadable report, because they come from the same
 * place — a spreadsheet you have to open to answer "how did that job go" is a
 * worse answer than a page you can look at. The download stays for accounts,
 * who need it in a sheet they can work in.
 */
export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const event = useAsync(() => (eventId ? fetchEvent(eventId) : Promise.resolve(null)), [eventId])
  const costs = useAsync(
    () => (eventId ? fetchEventCosts(eventId) : Promise.resolve([])),
    [eventId],
  )
  const [showAll, setShowAll] = useState(false)

  const lines = costs.data ?? []
  const totals = useMemo(() => summarise(lines), [lines])

  // Anything that moved is worth reading; rows where nothing happened are
  // noise on a bill.
  const visible = useMemo(
    () =>
      showAll
        ? lines
        : lines.filter((l) => Number(l.qty_out) > 0 || Number(l.qty_used) > 0),
    [lines, showAll],
  )

  if (event.loading || costs.loading) return <Loading />
  if (event.error) return <ErrorText>{event.error.message}</ErrorText>
  if (!event.data) {
    return (
      <EmptyState
        title="No such event"
        hint="It may have been deleted."
        action={
          <Link to="/admin/events" className="btn btn-ghost">
            Back to events
          </Link>
        }
      />
    )
  }

  const ev = event.data

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <Link
          to="/admin/events"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Events
        </Link>
      </div>

      <PageHeader
        title={ev.name}
        description={
          <>
            {[ev.client, ev.venue].filter(Boolean).join(' · ')}
            {(ev.client || ev.venue) && ' · '}
            {new Date(ev.starts_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {' – '}
            {new Date(ev.ends_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            <span className="badge badge-neutral ml-2 capitalize">{ev.status}</span>
          </>
        }
        actions={
          <button
            className="btn btn-ghost"
            onClick={() => downloadReport(ev, lines)}
            disabled={lines.length === 0}
          >
            Download for accounts
          </button>
        }
      />

      {costs.error && <ErrorText>{costs.error.message}</ErrorText>}

      {lines.length === 0 ? (
        <EmptyState
          title="Nothing has moved for this event"
          hint="Once stock is taken out against it, the bill builds itself here."
        />
      ) : (
        <>
          {/* Taken out, then what became of it, then what it involved. Read
              left to right that's the whole event. */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Stat label="Value taken out" value={formatMoney(totals.costTakenOut)} />
            <Stat label="Cost of stock used" value={formatMoney(totals.costUsed)} />
            <Stat label="Value came back" value={formatMoney(totals.costReturned)} />
            <Stat label="Items involved" value={totals.itemCount} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2 items-start">
            <OutcomeBar totals={totals} />
            <TopItemsChart lines={lines} />
          </div>

          {totals.unpriced > 0 && (
            /* Say what the total is missing. A bill that quietly drops the
               items it couldn't price reads as complete when it isn't. */
            <div className="rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5">
              <p className="text-sm text-warn-700">
                <span className="font-semibold">{totals.unpriced}</span> of{' '}
                {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'} have no price on
                file, so they aren't counted in any figure above. Set their prices on the
                master sheet and this fills in.
              </p>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-alt border-b border-line">
                  <tr className="text-left">
                    <th className="th">Item</th>
                    <th className="th text-right">Taken out</th>
                    <th
                      className="th text-right"
                      title="Everything that physically came back — sealed packs and part-used bottles both."
                    >
                      Back
                    </th>
                    <th className="th text-right" title="Served to guests">
                      Served
                    </th>
                    <th className="th text-right" title="Spilled or wasted">
                      Spilled
                    </th>
                    <th className="th text-right" title="Never came back">
                      Missing
                    </th>
                    <th className="th text-right">Still out</th>
                    <th className="th text-right">Price</th>
                    <th className="th text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((l) => (
                    <CostRow key={l.item_id} line={l} />
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-line-strong bg-surface-alt">
                  <tr>
                    <td className="px-3 py-2.5 font-semibold" colSpan={8}>
                      Total cost of stock used
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular whitespace-nowrap">
                      {formatMoney(totals.costUsed)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {visible.length < lines.length && (
              <div className="px-3 py-2 border-t border-line bg-surface-alt">
                <button
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  onClick={() => setShowAll(true)}
                >
                  Show {lines.length - visible.length} item
                  {lines.length - visible.length === 1 ? '' : 's'} where nothing moved
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CostRow({ line }: { line: EventCostLine }) {
  const stillOut = Number(line.still_out)
  const damaged = Number(line.qty_damaged)

  const cell = (qty: number, className = 'text-fg-muted') =>
    qty > 0 ? (
      <span className={className}>{formatQty(qty, line)}</span>
    ) : (
      <span className="text-fg-subtle">—</span>
    )

  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{line.item_name}</span>
          {damaged > 0 && (
            <span
              className="badge badge-warn"
              title="Came back damaged. Still owned, so it isn't billed here."
            >
              {formatQty(damaged, line)} damaged
            </span>
          )}
        </div>
        {line.category_name && (
          <span className="block text-xs text-fg-subtle mt-0.5">{line.category_name}</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {cell(Number(line.qty_out))}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {cell(Number(line.qty_back_total))}
        {/* Say when some of it came back opened — "3 bottles back" and "2
            bottles plus a half-empty one" are different facts. */}
        {Number(line.qty_returned_loose) > 0 && (
          <span className="block text-[11px] text-fg-subtle">
            incl. {formatQty(line.qty_returned_loose, line)} opened
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {cell(Number(line.qty_consumed))}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {cell(Number(line.qty_wasted), 'text-warn-700')}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {cell(Number(line.qty_lost), 'text-bad-600')}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {stillOut > 0 ? (
          <span className="text-warn-700">{formatQty(stillOut, line)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular text-fg-muted whitespace-nowrap">
        {line.unit_cost == null ? (
          <span className="text-fg-subtle" title="No price on file">
            —
          </span>
        ) : (
          `${formatMoney(line.unit_cost)}/${line.unit}`
        )}
      </td>

      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {line.cost_used == null ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <span className="font-medium">{formatMoney(line.cost_used)}</span>
        )}
      </td>
    </tr>
  )
}
