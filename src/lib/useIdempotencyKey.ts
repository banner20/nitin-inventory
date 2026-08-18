import { useRef } from 'react'

/**
 * A stable id for one attempt to post something, held across retries — and
 * across the app being closed and reopened.
 *
 * The ledger refuses to write the same client_uuid twice; that is what makes a
 * retry over a bad connection safe. It only works if the retry carries the
 * *same* id, and originally every caller let postTxn mint a fresh one per
 * call, so the protection was off exactly when it was needed.
 *
 * Keeping the key in memory fixed the tap-twice case but not the worse one.
 * A basket now survives the app being killed, so this has to as well:
 * otherwise the request that quietly succeeded before the phone lost signal
 * comes back with a brand-new key, and saving again writes the stock out a
 * second time. The key lives beside the basket it belongs to, and is cleared
 * only once a post has definitely landed.
 */
export function useIdempotencyKey(storageKey?: string) {
  const ref = useRef<string | null>(null)
  /**
   * One submission can become several transactions — returning a van that two
   * people loaded posts one per person, because a transaction belongs to a
   * single holder. Each needs its own key, and each needs the *same* key on a
   * retry, so they're kept together under the one storage entry.
   */
  const parts = useRef<Record<string, string>>({})

  function read(): string | null {
    if (ref.current) return ref.current
    if (!storageKey) return null
    try {
      ref.current = localStorage.getItem(storageKey)
      return ref.current
    } catch {
      return null
    }
  }

  function readParts(): Record<string, string> {
    if (Object.keys(parts.current).length > 0) return parts.current
    if (!storageKey) return parts.current
    try {
      parts.current = JSON.parse(localStorage.getItem(`${storageKey}.parts`) ?? '{}')
    } catch {
      parts.current = {}
    }
    return parts.current
  }

  return {
    /**
     * The key left over from a previous attempt, without creating one.
     *
     * A stored key is ambiguous on its own: the last attempt either failed
     * outright, or succeeded and the reply was lost. Those need opposite
     * handling, so the caller looks the key up in the ledger before deciding.
     * Without that check a key could sit around and silently swallow a later,
     * genuinely different basket.
     */
    pending(): string | null {
      return read()
    },

    /** The id for this attempt, minted once and reused by every retry. */
    current(): string {
      const existing = read()
      if (existing) return existing

      const fresh = crypto.randomUUID()
      ref.current = fresh
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, fresh)
        } catch {
          // No storage available; still safe within this page's lifetime.
        }
      }
      return fresh
    },

    /**
     * A key for one part of a multi-transaction submission — one per person
     * whose stock is coming back. Stable across retries, like `current`.
     */
    forPart(partId: string): string {
      const map = readParts()
      if (!map[partId]) {
        map[partId] = crypto.randomUUID()
        if (storageKey) {
          try {
            localStorage.setItem(`${storageKey}.parts`, JSON.stringify(map))
          } catch {
            /* still safe within this page's lifetime */
          }
        }
      }
      return map[partId]
    },

    /** Call after a successful post: the next one is a different transaction. */
    reset(): void {
      ref.current = null
      parts.current = {}
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey)
          localStorage.removeItem(`${storageKey}.parts`)
        } catch {
          /* nothing useful to do */
        }
      }
    },
  }
}
