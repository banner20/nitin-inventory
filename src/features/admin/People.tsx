import { useState, type FormEvent } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/lib/useAsync'
import { fetchProfiles } from '@/lib/queries'
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  createUser,
  resetUserPassword,
  setUserActive,
  setUserRole,
} from '@/lib/auth'
import type { Profile, UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['crew', 'manager', 'admin']

const ROLE_HELP: Record<UserRole, string> = {
  crew: 'Signs gear out to themselves and brings it back. Sees only their own movements.',
  manager: 'Everything crew can do, plus the master sheet, events and all history.',
  admin: 'Everything, plus creating and deactivating accounts.',
}

export default function People() {
  const { profile: me } = useAuth()
  const { data, error, loading, reload } = useAsync(fetchProfiles, [])
  const [banner, setBanner] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const people = data ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold text-white">People</h1>
        <p className="text-sm text-ink-400">
          Accounts are created here. Nobody can sign themselves up.
        </p>
      </header>

      {banner && (
        <p
          className={
            banner.kind === 'ok'
              ? 'text-sm text-good-500'
              : 'text-sm text-bad-500'
          }
        >
          {banner.text}
        </p>
      )}

      <CreateUserForm
        onCreated={(name) => {
          setBanner({ kind: 'ok', text: `${name} can now sign in.` })
          reload()
        }}
        onError={(text) => setBanner({ kind: 'bad', text })}
      />

      <section className="space-y-3">
        <h2 className="font-semibold text-white">
          Everyone {!loading && <span className="text-ink-400 font-normal">({people.length})</span>}
        </h2>

        {loading && <p className="text-sm text-ink-400">Loading…</p>}
        {error && <p className="text-sm text-bad-500">Couldn’t load people. {error.message}</p>}

        {people.length > 0 && (
          <div className="card divide-y divide-ink-800">
            {people.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                isSelf={p.id === me?.id}
                onChanged={(text) => {
                  setBanner({ kind: 'ok', text })
                  reload()
                }}
                onError={(text) => setBanner({ kind: 'bad', text })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function CreateUserForm({
  onCreated,
  onError,
}: {
  onCreated: (name: string) => void
  onError: (text: string) => void
}) {
  const [empCode, setEmpCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('crew')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await createUser({ empCode, fullName, password, role, phone })
      onCreated(fullName.trim())
      setEmpCode('')
      setFullName('')
      setPassword('')
      setPhone('')
      setRole('crew')
    } catch (err) {
      onError(err instanceof AuthError ? err.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 space-y-4">
      <h2 className="font-semibold text-white">Add someone</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Full name</span>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Amit Sharma"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Employee code (their username)</span>
          <input
            className="input uppercase"
            value={empCode}
            onChange={(e) => setEmpCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="AMIT"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Password</span>
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="text"
            autoComplete="off"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-400">Phone (optional)</span>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+91 98200 00000"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-ink-400 mb-1">Role</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <label
              key={r}
              className={
                'flex gap-2 p-3 rounded-lg border cursor-pointer transition-colors ' +
                (role === r
                  ? 'border-brand-500 bg-ink-850'
                  : 'border-ink-700 hover:border-ink-600')
              }
            >
              <input
                type="radio"
                name="role"
                className="mt-0.5"
                checked={role === r}
                onChange={() => setRole(r)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white capitalize">{r}</span>
                <span className="block text-xs text-ink-400">{ROLE_HELP[r]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-ink-600">
        Write the password down before you submit — it is hashed on save and
        can’t be read back, only reset.
      </p>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || !empCode || !fullName || password.length < MIN_PASSWORD_LENGTH}
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}

function PersonRow({
  person,
  isSelf,
  onChanged,
  onError,
}: {
  person: Profile
  isSelf: boolean
  onChanged: (text: string) => void
  onError: (text: string) => void
}) {
  const [resetting, setResetting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>, okText: string) {
    setBusy(true)
    try {
      await fn()
      onChanged(okText)
    } catch (err) {
      onError(err instanceof AuthError ? err.message : 'That didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="font-medium text-white truncate">
            {person.full_name}
            {isSelf && <span className="text-ink-600 font-normal"> · you</span>}
            {!person.active && (
              <span className="ml-2 text-xs font-semibold text-warn-500">Deactivated</span>
            )}
          </p>
          <p className="text-xs text-ink-400">
            {person.emp_code}
            {person.phone ? ` · ${person.phone}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="input h-9 min-h-9 w-auto text-sm py-0"
            value={person.role}
            disabled={busy || isSelf}
            title={isSelf ? 'You cannot change your own role' : undefined}
            onChange={(e) =>
              void run(
                () => setUserRole(person.id, e.target.value as UserRole),
                `${person.full_name} is now ${e.target.value}.`,
              )
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            className="btn btn-ghost h-9 min-h-9 text-sm px-3"
            onClick={() => setResetting((r) => !r)}
            disabled={busy}
          >
            Reset password
          </button>

          {!isSelf && (
            <button
              className={
                person.active
                  ? 'btn btn-ghost h-9 min-h-9 text-sm px-3 text-warn-500'
                  : 'btn btn-ghost h-9 min-h-9 text-sm px-3 text-good-500'
              }
              disabled={busy}
              onClick={() =>
                void run(
                  () => setUserActive(person.id, !person.active),
                  person.active
                    ? `${person.full_name} can no longer sign in.`
                    : `${person.full_name} can sign in again.`,
                )
              }
            >
              {person.active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {resetting && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await resetUserPassword(person.id, newPassword)
              setNewPassword('')
              setResetting(false)
            }, `Password reset for ${person.full_name}.`)
          }}
        >
          <input
            className="input w-auto flex-1 min-w-48"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`New password (min ${MIN_PASSWORD_LENGTH})`}
            aria-label={`New password for ${person.full_name}`}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary h-11"
            disabled={busy || newPassword.length < MIN_PASSWORD_LENGTH}
          >
            Set
          </button>
        </form>
      )}
    </div>
  )
}
