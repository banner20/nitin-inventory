import { useRef } from 'react'

/**
 * A stable id for one attempt to post something, held across retries.
 *
 * The ledger already refuses to write the same client_uuid twice — that's what
 * makes a retry over a bad connection safe. But it only works if the retry
 * carries the *same* id, and every caller was letting postTxn mint a fresh one
 * per call. So the protection was switched off exactly when it mattered: crew
 * taps "Take out", the request times out on a dock with one bar of signal, they
 * tap again because nothing happened, and the second tap looked like a new
 * transaction. Stock signed out twice.
 *
 * The key is created on the first attempt and kept until one succeeds, so
 * every retry of the same basket collapses onto one transaction. Clearing it
 * afterwards means the next basket is genuinely new.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null)

  return {
    /** The id for this attempt, minted once and reused by every retry. */
    current(): string {
      if (!ref.current) ref.current = crypto.randomUUID()
      return ref.current
    },
    /** Call after a successful post: the next one is a different transaction. */
    reset(): void {
      ref.current = null
    },
  }
}
