import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { fetchItemAvailability, fetchOverdueBalances, fetchProfiles } from '@/lib/queries'
import { fetchDuplicateCandidates, mergeItems, postTxn, type DuplicateCandidate } from '@/lib/txns'
import { formatPacks, type ItemAvailability, type OpenBalance } from '@/lib/types'

/**
 * Everything the system knows needs a human decision, in one place: possible
 * duplicate items, stock that doesn't add up, and gear still out past its
 * event.
 */
export default function ConflictQueue() {
  const items = useAsync(fetchItemAvailability, [])
  const duplicates = useAsync(fetchDuplicateCandidates, [])
  const overdue = useAsync(fetchOverdueBalances, [])
  const profiles = useAsync(fetchProfiles, [])

  const needsReview = (items.data ?? []).filter((i) => Number(i.qty_available) < 0)

  const total = duplicates.data?.length ?? 0
  const totalReview = needsReview.length
  const totalOverdue = overdue.data?.length ?? 0

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-xl font-semibold text-white">Conflicts</h1>
        <p className="text-sm text-ink-400">
          Everything that needs a manager's eyes, in one list.
        </p>
      </header>

      <DuplicatesSection
        candidates={duplicates.data ?? []}
        items={items.data ?? []}
        loading={duplicates.loading}
        error={duplicates.error}
        onMerged={() => {
          duplicates.reload()
          items.reload()
        }}
      />

      <NeedsReviewSection items={needsReview} loading={items.loading} error={items.error} />

      <OverdueSection
        balances={overdue.data ?? []}
        profiles={profiles.data ?? []}
        loading={overdue.loading || profiles.loading}
        error={overdue.error}
        onWrittenOff={() => overdue.reload()}
      />

      {!duplicates.loading &&
        !items.loading &&
        !overdue.loading &&
        total === 0 &&
        totalReview === 0 &&
        totalOverdue === 0 && (
          <div className="card p-6 text-center text-sm text-ink-400">
            Nothing needs attention right now.
          </div>
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Possible duplicate items
// ---------------------------------------------------------------------------

function DuplicatesSection({
  candidates,
  items,
  loading,
  error,
  onMerged,
}: {
  candidates: DuplicateCandidate[]
  items: ItemAvailability[]
  loading: boolean
  error: Error | null
  onMerged: () => void
}) {
  const byId = new Map(items.map((i) => [i.item_id, i]))

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-white">
        Possible duplicate items {candidates.length > 0 && `(${candidates.length})`}
      </h2>
      <p className="text-sm text-ink-400">
        Items whose names look like the same thing typed two different ways.
      </p>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}
      {error && <p className="text-sm text-bad-500">{error.message}</p>}

      {!loading && candidates.length === 0 && (
        <div className="card p-4 text-sm text-ink-400">No likely duplicates found.</div>
      )}

      {candidates.length > 0 && (
        <ul className="space-y-2">
          {candidates.map((c) => (
            <DuplicateRow
              key={`${c.item_a_id}-${c.item_b_id}`}
              candidate={c}
              a={byId.get(c.item_a_id)}
              b={byId.get(c.item_b_id)}
              onMerged={onMerged}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function DuplicateRow({
  candidate,
  a,
  b,
  onMerged,
}: {
  candidate: DuplicateCandidate
  a?: ItemAvailability
  b?: ItemAvailability
  onMerged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'a' | 'b' | null>(null)

  async function merge(keep: 'a' | 'b') {
    setBusy(true)
    setError(null)
    try {
      if (keep === 'a') await mergeItems(candidate.item_a_id, candidate.item_b_id)
      else await mergeItems(candidate.item_b_id, candidate.item_a_id)
      onMerged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge.')
      setConfirming(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ItemSummary label={candidate.item_a_name} item={a} />
        <ItemSummary label={candidate.item_b_name} item={b} />
      </div>

      {error && <p className="text-sm text-bad-500">{error}</p>}

      {confirming ? (
        <div className="rounded-lg border border-warn-500/40 bg-warn-500/10 p-3 space-y-2">
          <p className="text-sm text-ink-200">
            Keep <strong>{confirming === 'a' ? candidate.item_a_name : candidate.item_b_name}</strong>{' '}
            and fold <strong>{confirming === 'a' ? candidate.item_b_name : candidate.item_a_name}</strong>{' '}
            into it? All its history moves over; it's kept in the records but hidden from the
            master sheet, and its name still works as a search alias.
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void merge(confirming)}
              disabled={busy}
            >
              {busy ? 'Merging…' : 'Yes, merge'}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost text-sm" onClick={() => setConfirming('a')}>
            Keep “{candidate.item_a_name}”
          </button>
          <button className="btn btn-ghost text-sm" onClick={() => setConfirming('b')}>
            Keep “{candidate.item_b_name}”
          </button>
          <span className="text-xs text-ink-600 self-center ml-auto">
            {Math.round(candidate.similarity * 100)}% alike
          </span>
        </div>
      )}
    </li>
  )
}

function ItemSummary({ label, item }: { label: string; item?: ItemAvailability }) {
  return (
    <div className="min-w-0">
      <p className="text-white truncate">{label}</p>
      {item && (
        <p className="text-xs text-ink-400">
          {formatPacks(item.qty_owned, item)} owned · {item.category_name ?? 'Uncategorised'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stock that doesn't add up
// ---------------------------------------------------------------------------

function NeedsReviewSection({
  items,
  loading,
  error,
}: {
  items: ItemAvailability[]
  loading: boolean
  error: Error | null
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-white">
        Stock that doesn't add up {items.length > 0 && `(${items.length})`}
      </h2>
      <p className="text-sm text-ink-400">
        More has gone out than was ever recorded coming in. Usually means the opening
        count or a delivery was never entered — add it through Stock in and this
        clears on its own.
      </p>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}
      {error && <p className="text-sm text-bad-500">{error.message}</p>}

      {!loading && items.length === 0 && (
        <div className="card p-4 text-sm text-ink-400">
          Nothing — every item's numbers add up.
        </div>
      )}

      {items.length > 0 && (
        <ul className="card divide-y divide-ink-800">
          {items.map((i) => (
            <li key={i.item_id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white truncate">{i.name}</p>
                <p className="text-xs text-bad-500">
                  Short by {formatPacks(-Number(i.qty_available), i)}
                </p>
              </div>
              <Link
                to={`/admin/stock-in?item=${i.item_id}`}
                className="btn btn-primary h-9 min-h-9 text-sm px-3 shrink-0"
              >
                Add stock-in
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Overdue returns
// ---------------------------------------------------------------------------

function OverdueSection({
  balances,
  profiles,
  loading,
  error,
  onWrittenOff,
}: {
  balances: OpenBalance[]
  profiles: { id: string; full_name: string }[]
  loading: boolean
  error: Error | null
  onWrittenOff: () => void
}) {
  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name]))

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-white">
        Overdue returns {balances.length > 0 && `(${balances.length})`}
      </h2>
      <p className="text-sm text-ink-400">
        Still signed out past the event's end date. Write off as missing once it's
        clearly not coming back.
      </p>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}
      {error && <p className="text-sm text-bad-500">{error.message}</p>}

      {!loading && balances.length === 0 && (
        <div className="card p-4 text-sm text-ink-400">Nothing overdue.</div>
      )}

      {balances.length > 0 && (
        <ul className="card divide-y divide-ink-800">
          {balances.map((b) => (
            <OverdueRow
              key={`${b.event_id}-${b.person_id}-${b.item_id}`}
              bal={b}
              personName={nameOf.get(b.person_id) ?? 'Unknown'}
              onWrittenOff={onWrittenOff}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function OverdueRow({
  bal,
  personName,
  onWrittenOff,
}: {
  bal: OpenBalance
  personName: string
  onWrittenOff: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function writeOff() {
    setBusy(true)
    setError(null)
    try {
      await postTxn({
        type: 'IN',
        eventId: bal.event_id,
        personId: bal.person_id,
        lines: [{ item_id: bal.item_id, qty: bal.outstanding, condition: 'lost' }],
      })
      onWrittenOff()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write off.')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white truncate">{bal.item_name}</p>
          <p className="text-xs text-ink-400 truncate">
            {formatPacks(bal.outstanding, bal)} · {personName} · {bal.event_name}
          </p>
        </div>
        {!confirming && (
          <button
            className="btn btn-ghost h-9 min-h-9 text-sm px-3 shrink-0"
            onClick={() => setConfirming(true)}
          >
            Write off
          </button>
        )}
      </div>

      {error && <p className="text-sm text-bad-500">{error}</p>}

      {confirming && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-400">
            Mark {formatPacks(bal.outstanding, bal)} as missing?
          </span>
          <button className="btn btn-primary h-9 min-h-9 px-3" onClick={() => void writeOff()} disabled={busy}>
            {busy ? 'Saving…' : 'Confirm'}
          </button>
          <button className="btn btn-ghost h-9 min-h-9 px-3" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}
