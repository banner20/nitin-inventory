import { useState, type FormEvent } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { changeOwnPassword, MIN_PASSWORD_LENGTH, AuthError } from '@/lib/auth'

export default function Me() {
  const { profile, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password !== confirm) {
      setMsg({ kind: 'bad', text: 'The two passwords don’t match.' })
      return
    }
    setBusy(true)
    try {
      await changeOwnPassword(password)
      setPassword('')
      setConfirm('')
      setMsg({ kind: 'ok', text: 'Password updated.' })
    } catch (err) {
      setMsg({
        kind: 'bad',
        text: err instanceof AuthError ? err.message : 'Could not update password.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="card p-4 space-y-1">
        <p className="text-lg font-semibold">{profile?.full_name}</p>
        <p className="text-sm text-fg-muted">
          {profile?.emp_code} · <span className="capitalize">{profile?.role}</span>
        </p>
        {profile?.phone && <p className="text-sm text-fg-muted">{profile.phone}</p>}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Change password</h2>
        <form onSubmit={onChangePassword} className="space-y-3">
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder={`New password (min ${MIN_PASSWORD_LENGTH})`}
            aria-label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {msg && (
            <p className={msg.kind === 'ok' ? 'text-sm text-good-600' : 'text-sm text-bad-600'}>
              {msg.text}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || password.length < MIN_PASSWORD_LENGTH}
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>

      <button onClick={() => void signOut()} className="btn btn-ghost w-full">
        Sign out
      </button>
    </div>
  )
}
