// Vercel Edge Function — the only place the Groq API key is ever read.
// It never reaches the client: this runs server-side, and the key lives in
// the Vercel project's environment variables (GROQ_API_KEY, no VITE_ prefix
// so it's never bundled into the app).
export const config = { runtime: 'edge' }

/**
 * A signed-in employee is not the same thing as an authenticated request.
 *
 * This endpoint sits outside the app entirely — the employee-code login gates
 * the React screens, not a public HTTPS route on the same domain. Anyone who
 * found this URL could POST audio to it from anywhere and spend the Groq
 * budget, indefinitely, with no account and nothing to revoke.
 *
 * So the caller has to present the access token Supabase already gave them at
 * login, and it gets checked against Supabase before a request costs anything.
 * Verifying it here rather than trusting a header means a forged token fails.
 */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024 // ~8 minutes of webm speech

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function callerIsSignedIn(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return false

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: anonKey },
    })
    return res.ok
  } catch {
    // Can't reach Supabase to check — refuse rather than wave it through.
    return false
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!(await callerIsSignedIn(request))) {
    return json({ error: 'Sign in to use voice input.' }, 401)
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return json({ error: 'Voice input is not configured on the server yet.' }, 500)
  }

  const incoming = await request.formData()
  const audio = incoming.get('audio')
  // Names from the master sheet, sent by the client — Whisper's prompt field
  // biases its vocabulary toward whatever it's given, so "Xanthan Gum" gets
  // recognized instead of misheard as something that merely sounds like it.
  const vocabulary = incoming.get('vocabulary')

  if (!(audio instanceof Blob) || audio.size === 0) {
    return json({ error: 'No audio received.' }, 400)
  }

  // A cap, so one signed-in account can't send a feature film either.
  if (audio.size > MAX_AUDIO_BYTES) {
    return json({ error: 'That recording is too long. Keep it under a few minutes.' }, 413)
  }

  const form = new FormData()
  form.append('file', audio, 'audio.webm')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'json')
  if (typeof vocabulary === 'string' && vocabulary.trim()) {
    // Groq rejects anything over 896 characters outright (not a silent
    // truncation) — confirmed by an actual "prompt length must be 896
    // characters or fewer" error, so this cap is exact, not a guess.
    form.append('prompt', vocabulary.slice(0, 896))
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!groqRes.ok) {
    const detail = await groqRes.text()
    return json({ error: 'Transcription failed', detail }, 502)
  }

  const data = (await groqRes.json()) as { text?: string }
  return json({ text: data.text ?? '' }, 200)
}
