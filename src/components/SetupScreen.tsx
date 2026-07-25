/** Shown when the app has no Supabase credentials yet. */
export default function SetupScreen() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="card p-6 max-w-lg w-full space-y-4">
        <h1 className="text-lg font-semibold text-white">Almost there</h1>
        <p className="text-sm text-ink-400">
          The app can’t reach a database yet. Create a project at{' '}
          <a
            className="text-brand-400 underline"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            supabase.com
          </a>
          , then copy <code className="text-ink-200">.env.example</code> to{' '}
          <code className="text-ink-200">.env.local</code> and fill in:
        </p>
        <pre className="bg-ink-950 border border-ink-800 rounded-lg p-3 text-xs overflow-x-auto text-ink-200">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="text-sm text-ink-400">
          Both values are on the project’s <strong>API settings</strong> page.
          Restart <code className="text-ink-200">npm run dev</code> afterwards —
          Vite only reads env files at startup.
        </p>
      </div>
    </main>
  )
}
