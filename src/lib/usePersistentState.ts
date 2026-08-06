import { useEffect, useRef, useState } from 'react'

/**
 * State that survives a reload, a crash, or a phone deciding to kill the tab.
 *
 * Full offline sync — a queue, replay, conflict resolution — is a large piece
 * of work and mostly solves a problem this app doesn't have: nothing here is
 * edited by two people at once. The failure that actually happens is smaller
 * and much more annoying. Someone spends ten minutes loading a van on a screen
 * in a store room with no signal, hits save, it fails, and the basket is gone.
 *
 * Keeping the in-progress basket on the device covers that. Combined with a
 * stable idempotency key, the retry is safe whenever the signal comes back,
 * and nothing is retyped in the meantime.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      // Corrupt or unreadable storage is not worth failing a screen over.
      return initial
    }
  })

  // Skip the write on first render so mounting doesn't immediately re-save
  // what was just read back.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private mode, or a full quota. The basket still works in memory.
    }
  }, [key, value])

  function clear() {
    try {
      localStorage.removeItem(key)
    } catch {
      /* nothing useful to do */
    }
  }

  return [value, setValue, clear]
}
