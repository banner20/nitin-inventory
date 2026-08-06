import { useState, type FormEvent } from 'react'
import { useAsync } from '@/lib/useAsync'
import { createEvent, fetchAllEvents, setEventStatus } from '@/lib/events'
import { fetchEventCosts } from '@/lib/queries'
import { downloadTextFile, objectsToCsv } from '@/lib/csv'
import { formatQty, type EventRecord, type EventStatus } from '@/lib/types'

const STATUS_STYLE: Record<EventStatus, string> = {
  planned: 'text-fg-muted',
  out: 'text-brand-600',
  closed: 'text-fg-subtle',
  cancelled: 'text-fg-subtle line-through',
}

/**
 * The accounts report.
 *
 * Two kinds of column on purpose: plain numbers in the item's base unit, which
 * a spreadsheet can total and multiply, and a readable version beside them for
 * the person checking it against what actually happened. Accounts need to do
 * arithmetic; whoever signs it off needs to recognise "2 bottles + 250 ml".
 *
 * Damaged is listed but not billed — it's still owned, just not usable yet, so
 * charging for it here would double-count once it's repaired or written off.
 */
const REPORT_COLUMNS = [
  'Item',
  'Category',
  'Unit',
  'Pack',
  'Taken out',
  'Taken out (readable)',
  'Brought back',
  'Served',
  'Spilled',
  'Missing',
  'Damaged',
  'Still out',
  'Used up',
  'Used up (readable)',
  'Price per unit',
  'Cost of stock used',
]

async function downloadEventReport(event: EventRecord): Promise<void> {
  const lines = await fetchEventCosts(event.id)

  const num = (n: number | null | undefined) => (n == null ? '' : String(Number(n)))

  const rows = lines.map((l) => ({
    Item: l.item_name,
    Category: l.category_name ?? '',
    Unit: l.unit,
    Pack: l.pack_label ? `${l.pack_size} ${l.unit} per ${l.pack_label}` : '',
    'Taken out': num(l.qty_out),
    'Taken out (readable)': formatQty(l.qty_out, l),
    'Brought back': num(l.qty_returned),
    Served: num(l.qty_consumed),
    Spilled: num(l.qty_wasted),
    Missing: num(l.qty_lost),
    Damaged: num(l.qty_damaged),
    'Still out': num(l.still_out),
    'Used up': num(l.qty_used),
    'Used up (readable)': formatQty(l.qty_used, l),
    'Price per unit': l.unit_cost == null ? '' : String(Number(l.unit_cost)),
    'Cost of stock used': l.cost_used == null ? '' : String(Number(l.cost_used)),
  }))

  const totalCost = lines.reduce((sum, l) => sum + Number(l.cost_used ?? 0), 0)
  const unpriced = lines.filter((l) => l.unit_cost == null).length

  // A total row, then a note if any of it couldn't be costed — a bill that
  // silently omits the items with no price on file is worse than one that
  // says so.
  rows.push({
    ...Object.fromEntries(REPORT_COLUMNS.map((c) => [c, ''])),
    Item: 'TOTAL',
    'Cost of stock used': String(Number(totalCost.toFixed(2))),
  } as (typeof rows)[number])

  if (unpriced > 0) {
    rows.push({
      ...Object.fromEntries(REPORT_COLUMNS.map((c) => [c, ''])),
      Item: `Note: ${unpriced} item${unpriced === 1 ? '' : 's'} had no price on file and are not included in the total.`,
    } as (typeof rows)[number])
  }

  const safeName = event.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const date = new Date(event.starts_at).toISOString().slice(0, 10)
  downloadTextFile(`${date}-${safeName}-accounts.csv`, objectsToCsv(rows, REPORT_COLUMNS))
}

/** Local datetime string for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Events() {
  const events = useAsync(fetchAllEvents, [])
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const list = events.data ?? []

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Events</h1>
          <p className="text-sm text-fg-muted">
            Stock can only go out against an event, so this is what the crew pick from.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : 'New event'}
        </button>
      </header>

      {msg && <p className="text-sm text-good-600">{msg}</p>}

      {adding && (
        <NewEventForm
          onCreated={(name) => {
            setAdding(false)
            setMsg(`${name} created — crew can load for it now.`)
            events.reload()
          }}
        />
      )}

      {events.loading && <p className="text-sm text-fg-muted">Loading…</p>}
      {events.error && <p className="text-sm text-bad-600">{events.error.message}</p>}

      {!events.loading && list.length === 0 && (
        <div className="card p-6 text-center text-sm text-fg-muted">
          No events yet. Create one so stock has somewhere to go.
        </div>
      )}

      {list.length > 0 && (
        <div className="card divide-y divide-line">
          {list.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              onChanged={(text) => {
                setMsg(text)
                events.reload()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({
  event,
  onChanged,
}: {
  event: EventRecord
  onChanged: (text: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  async function change(status: EventStatus) {
    setBusy(true)
    try {
      await setEventStatus(event.id, status)
      onChanged(`${event.name} marked ${status}.`)
    } finally {
      setBusy(false)
    }
  }

  async function report() {
    setDownloading(true)
    setReportError(null)
    try {
      await downloadEventReport(event)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not build the report.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">
          {event.name}
          <span className={`ml-2 text-xs font-normal ${STATUS_STYLE[event.status]}`}>
            {event.status}
          </span>
        </p>
        <p className="text-xs text-fg-muted">
          {event.client ? `${event.client} · ` : ''}
          {event.venue ? `${event.venue} · ` : ''}
          {new Date(event.starts_at).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {reportError && <span className="text-xs text-bad-600">{reportError}</span>}

        <button
          type="button"
          className="btn btn-ghost h-9 min-h-9 text-sm px-3"
          onClick={() => void report()}
          disabled={downloading}
          title="Download a spreadsheet of what this event used and what it cost"
        >
          {downloading ? 'Building…' : 'Accounts report'}
        </button>

        <select
          className="input h-9 min-h-9 w-auto text-sm py-0"
          value={event.status}
          disabled={busy}
          onChange={(e) => void change(e.target.value as EventStatus)}
          aria-label={`Status of ${event.name}`}
        >
          <option value="planned">planned</option>
          <option value="out">out</option>
          <option value="closed">closed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>
    </div>
  )
}

function NewEventForm({ onCreated }: { onCreated: (name: string) => void }) {
  const now = new Date()
  const later = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [venue, setVenue] = useState('')
  const [startsAt, setStartsAt] = useState(toLocalInput(now))
  const [endsAt, setEndsAt] = useState(toLocalInput(later))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createEvent({
        name,
        client,
        venue,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      })
      onCreated(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm text-fg-muted">Event name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mehta Sangeet — bar service"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Client (optional)</span>
          <input className="input" value={client} onChange={(e) => setClient(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Venue (optional)</span>
          <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-fg-muted">Ends</span>
          <input
            className="input"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </label>
      </div>

      <p className="text-xs text-fg-subtle">
        The end time is what makes stock show as overdue, so it's worth being roughly right.
      </p>

      {error && <p className="text-sm text-bad-600">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
