import { useState, type FormEvent } from 'react'
import { useAsync } from '@/lib/useAsync'
import { createEvent, fetchAllEvents, setEventStatus } from '@/lib/events'
import type { EventRecord, EventStatus } from '@/lib/types'

const STATUS_STYLE: Record<EventStatus, string> = {
  planned: 'text-ink-400',
  out: 'text-brand-400',
  closed: 'text-ink-600',
  cancelled: 'text-ink-600 line-through',
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
          <h1 className="text-xl font-semibold text-white">Events</h1>
          <p className="text-sm text-ink-400">
            Stock can only go out against an event, so this is what the crew pick from.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : 'New event'}
        </button>
      </header>

      {msg && <p className="text-sm text-good-500">{msg}</p>}

      {adding && (
        <NewEventForm
          onCreated={(name) => {
            setAdding(false)
            setMsg(`${name} created — crew can load for it now.`)
            events.reload()
          }}
        />
      )}

      {events.loading && <p className="text-sm text-ink-400">Loading…</p>}
      {events.error && <p className="text-sm text-bad-500">{events.error.message}</p>}

      {!events.loading && list.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-400">
          No events yet. Create one so stock has somewhere to go.
        </div>
      )}

      {list.length > 0 && (
        <div className="card divide-y divide-ink-800">
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

  async function change(status: EventStatus) {
    setBusy(true)
    try {
      await setEventStatus(event.id, status)
      onChanged(`${event.name} marked ${status}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-white truncate">
          {event.name}
          <span className={`ml-2 text-xs font-normal ${STATUS_STYLE[event.status]}`}>
            {event.status}
          </span>
        </p>
        <p className="text-xs text-ink-400">
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
          <span className="text-sm text-ink-400">Event name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mehta Sangeet — bar service"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Client (optional)</span>
          <input className="input" value={client} onChange={(e) => setClient(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Venue (optional)</span>
          <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Ends</span>
          <input
            className="input"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </label>
      </div>

      <p className="text-xs text-ink-600">
        The end time is what makes stock show as overdue, so it's worth being roughly right.
      </p>

      {error && <p className="text-sm text-bad-500">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
