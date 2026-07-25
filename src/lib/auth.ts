import { supabase } from './supabase'
import type { Profile, UserRole } from './types'

/**
 * Crew sign in with an employee code and a password. Under the hood that maps
 * onto Supabase email/password so RLS, JWTs and refresh tokens all work
 * normally — the "email" is synthetic and never receives mail, which is why
 * nobody needs a real address to be given an account.
 */
const EMAIL_DOMAIN = 'nitin.local'

export const MIN_PASSWORD_LENGTH = 6

export function empCodeToEmail(empCode: string): string {
  return `${empCode.trim().toLowerCase()}@${EMAIL_DOMAIN}`
}

export class AuthError extends Error {}

export async function signIn(empCode: string, password: string): Promise<void> {
  const code = empCode.trim()
  if (!code) throw new AuthError('Enter your employee code.')
  if (!password) throw new AuthError('Enter your password.')

  const { error } = await supabase.auth.signInWithPassword({
    email: empCodeToEmail(code),
    password,
  })

  if (error) {
    // Don't leak whether the code exists — same message either way.
    throw new AuthError('That employee code and password don’t match.')
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

/** Change your own password. */
export async function changeOwnPassword(newPassword: string): Promise<void> {
  assertPasswordLength(newPassword)
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new AuthError(error.message)
}

function assertPasswordLength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
}

/**
 * Admin account management. These call SECURITY DEFINER functions in the
 * database, which re-check that the caller is an admin — the UI hiding a
 * button is convenience, the database refusing is the actual control.
 */
export interface NewUserInput {
  empCode: string
  fullName: string
  password: string
  role: UserRole
  phone?: string
}

export async function createUser(input: NewUserInput): Promise<string> {
  assertPasswordLength(input.password)

  const { data, error } = await supabase.rpc('create_app_user', {
    p_emp_code: input.empCode,
    p_full_name: input.fullName,
    p_password: input.password,
    p_role: input.role,
    p_phone: input.phone ?? null,
  })

  if (error) throw new AuthError(humanise(error.message))
  return data as string
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  assertPasswordLength(password)
  const { error } = await supabase.rpc('set_app_user_password', {
    p_user_id: userId,
    p_password: password,
  })
  if (error) throw new AuthError(humanise(error.message))
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_app_user_active', {
    p_user_id: userId,
    p_active: active,
  })
  if (error) throw new AuthError(humanise(error.message))
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc('set_app_user_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw new AuthError(humanise(error.message))
}

/** Postgres error text is honest but shouty; soften the common ones. */
function humanise(message: string): string {
  if (message.includes('already taken')) return 'That employee code is already in use.'
  if (message.includes('insufficient_privilege') || message.includes('Only an admin')) {
    return 'Only an admin can do that.'
  }
  return message
}
