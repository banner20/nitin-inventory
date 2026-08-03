// Vercel Edge Function — the only place the Groq API key is ever read.
// It never reaches the client: this runs server-side, and the key lives in
// the Vercel project's environment variables (GROQ_API_KEY, no VITE_ prefix
// so it's never bundled into the app).
export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Voice input is not configured on the server yet.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const audio = await request.blob()
  if (audio.size === 0) {
    return new Response(JSON.stringify({ error: 'No audio received.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const form = new FormData()
  form.append('file', audio, 'audio.webm')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'json')

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!groqRes.ok) {
    const detail = await groqRes.text()
    return new Response(JSON.stringify({ error: 'Transcription failed', detail }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }

  const data = (await groqRes.json()) as { text?: string }
  return new Response(JSON.stringify({ text: data.text ?? '' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
