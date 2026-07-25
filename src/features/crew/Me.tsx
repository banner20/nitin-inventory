import { useState, type FormEvent } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { changePin, PIN_LENGTH, AuthError } from '@/lib/auth'

export default function Me() {
  const { profile, signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onChangePin(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (pin !== confirm) {
      setMsg({ kind: 'bad', text: 'The two PINs don’t match.' })
      return
    }
    setBusy(true)
    try {
      await changePin(pin)
      setPin('')
      setConfirm('')
      setMsg({ kind: 'ok', text: 'PIN updated.' })
    } catch (err) {
      setMsg({
        kind: 'bad',
        text: err instanceof AuthError ? err.message : 'Could not update PIN.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="card p-4 space-y-1">
        <p className="text-lg font-semibold text-white">{profile?.full_name}</p>
        <p className="text-sm text-ink-400">
          {profile?.emp_code} · <span className="capitalize">{profile?.role}</span>
        </p>
        {profile?.phone && <p className="text-sm text-ink-400">{profile.phone}</p>}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-white">Change PIN</h2>
        <form onSubmit={onChangePin} className="space-y-3">
          <input
            className="input tabular tracking-[0.4em]"
            type="password"
            inputMode="numeric"
            placeholder="New PIN"
            aria-label="New PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
          />
          <input
            className="input tabular tracking-[0.4em]"
            type="password"
            inputMode="numeric"
            placeholder="Confirm PIN"
            aria-label="Confirm new PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
          />
          {msg && (
            <p className={msg.kind === 'ok' ? 'text-sm text-good-500' : 'text-sm text-bad-500'}>
              {msg.text}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || pin.length !== PIN_LENGTH}
          >
            {busy ? 'Saving…' : 'Update PIN'}
          </button>
        </form>
      </section>

      <button onClick={() => void signOut()} className="btn btn-ghost w-full">
        Sign out
      </button>
    </div>
  )
}
