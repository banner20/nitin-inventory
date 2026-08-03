import { useRef, useState } from 'react'
import { itemMatches, type ItemAvailability } from './types'

/** Records from the mic, uploads to the transcription proxy, and returns the
 * heard text. The Groq key never touches this file or the client bundle —
 * it lives server-side in api/transcribe.ts. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError("Couldn't access the microphone — check the browser's permission for this site.")
    }
  }

  /** Stops recording, uploads the clip, and returns the transcript text. */
  async function stopAndTranscribe(): Promise<string | null> {
    const recorder = recorderRef.current
    if (!recorder) return null

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      recorder.stop()
    })
    setRecording(false)
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: blob })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not transcribe that.')
      return (data.text as string) ?? ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice input failed.')
      return null
    } finally {
      setBusy(false)
    }
  }

  return { recording, busy, error, start, stopAndTranscribe }
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  couple: 2,
  few: 3,
  half: 1,
  dozen: 12,
}

const FILLER_WORDS = new Set([
  'of', 'bottle', 'bottles', 'bottel', 'x', 'and', 'the', 'some', 'take', 'out', 'add',
])

export interface VoiceMatch {
  item: ItemAvailability
  qty: number
  heard: string
}

export interface VoiceUnmatched {
  heard: string
}

/**
 * "Two bottles of vodka, one gin, three limes" → matched items with
 * quantities, plus whatever couldn't be matched to anything on the master
 * sheet — this is a best-effort read of natural speech, not a guarantee, so
 * the crew member reviews and adjusts before it's actually posted.
 */
export function parseVoiceTranscript(
  transcript: string,
  items: ItemAvailability[],
): { matched: VoiceMatch[]; unmatched: VoiceUnmatched[] } {
  const chunks = transcript
    .toLowerCase()
    .split(/[,.\n]| and /)
    .map((s) => s.trim())
    .filter(Boolean)

  const matched: VoiceMatch[] = []
  const unmatched: VoiceUnmatched[] = []

  for (const chunk of chunks) {
    const words = chunk.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    let qty = 1
    let rest = words
    const first = words[0]!
    if (/^\d+(\.\d+)?$/.test(first)) {
      qty = Number(first)
      rest = words.slice(1)
    } else if (NUMBER_WORDS[first] !== undefined) {
      qty = NUMBER_WORDS[first]
      rest = words.slice(1)
    }
    while (rest.length > 0 && FILLER_WORDS.has(rest[0]!)) rest = rest.slice(1)

    const name = rest.join(' ').trim()
    if (!name) continue

    const found =
      items.find((i) => itemMatches(i, name)) ??
      items.find((i) => {
        const lower = i.name.toLowerCase()
        return lower.includes(name) || name.includes(lower)
      })

    if (found) matched.push({ item: found, qty, heard: chunk })
    else unmatched.push({ heard: chunk })
  }

  return { matched, unmatched }
}
