import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'
import { AuthError } from '@/lib/auth'

/**
 * Two fields, big targets. This screen gets used on a loading dock with cold
 * hands — nothing clever belongs here.
 */
export default function LoginScreen() {
  const { signIn } = useAuth()
  const [empCode, setEmpCode] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(empCode, password)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not sign in. Try again.')
      setPassword('')
      passwordRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <header className="text-center space-y-2">
          <img src="/icon.svg" alt="" className="size-14 mx-auto" />
          <h1 className="text-2xl font-semibold text-white">Nitin Inventory</h1>
          <p className="text-sm text-ink-400">Sign in with your employee code.</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="empCode" className="text-sm font-medium text-ink-400">
              Employee code
            </label>
            <input
              id="empCode"
              className="input uppercase tracking-wide"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="AMIT"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="text-sm font-medium text-ink-400">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-xs text-ink-400 hover:text-ink-200"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="password"
              ref={passwordRef}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              enterKeyHint="go"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-bad-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || !empCode || !password}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-600">
          Forgotten your password? Ask a manager to reset it.
        </p>
      </div>
    </main>
  )
}
