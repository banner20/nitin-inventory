import { supabase } from './supabase'
import type { Profile } from './types'

/**
 * Crew sign in with an employee code and a 6-digit PIN. Under the hood that
 * maps onto Supabase email/password so RLS, JWTs and refresh tokens all work
 * normally — the "email" is synthetic and never receives mail.
 *
 * A 6-digit PIN is not a strong secret. The real protections are that every
 * action is attributed and audit-logged, destructive operations are
 * manager-only, and self-signup is disabled. That trade is deliberate: a login
 * nobody will do at 6am is worse than a simple one.
 */
const EMAIL_DOMAIN = 'nitin.local'

export const PIN_LENGTH = 6

export function empCodeToEmail(empCode: string): string {
  return `${empCode.trim().toLowerCase()}@${EMAIL_DOMAIN}`
}

export class AuthError extends Error {}

export async function signIn(empCode: string, pin: string): Promise<void> {
  const code = empCode.trim()
  if (!code) throw new AuthError('Enter your employee code.')
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new AuthError(`PIN must be ${PIN_LENGTH} digits.`)
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: empCodeToEmail(code),
    password: pin,
  })

  if (error) {
    // Don't leak whether the code exists — same message either way.
    throw new AuthError('That employee code and PIN don’t match.')
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** The signed-in user's profile, or null if there is no session. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, emp_code, full_name, phone, role, active')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as Profile | null) ?? null
}

export async function changePin(newPin: string): Promise<void> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(newPin)) {
    throw new AuthError(`PIN must be ${PIN_LENGTH} digits.`)
  }
  const { error } = await supabase.auth.updateUser({ password: newPin })
  if (error) throw new AuthError(error.message)
}
