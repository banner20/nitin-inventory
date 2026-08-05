/** Shown when the app has no Supabase credentials yet. */
export default function SetupScreen() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="card p-6 max-w-lg w-full space-y-4">
        <h1 className="text-lg font-semibold">Almost there</h1>
        <p className="text-sm text-fg-muted">
          The app can’t reach a database yet. Create a project at{' '}
          <a
            className="text-brand-600 underline"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            supabase.com
          </a>
          , then copy <code className="text-fg">.env.example</code> to{' '}
          <code className="text-fg">.env.local</code> and fill in:
        </p>
        <pre className="bg-canvas border border-line rounded-lg p-3 text-xs overflow-x-auto text-fg">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="text-sm text-fg-muted">
          Both values are on the project’s <strong>API settings</strong> page.
          Restart <code className="text-fg">npm run dev</code> afterwards —
          Vite only reads env files at startup.
        </p>
      </div>
    </main>
  )
}
