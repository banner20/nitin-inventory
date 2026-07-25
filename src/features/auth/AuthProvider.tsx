import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchProfile, signIn as doSignIn, signOut as doSignOut } from '@/lib/auth'
import type { Profile } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isManager: boolean
  signIn: (empCode: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Load the profile that belongs to a session. A session without a matching
  // active profile means the account was deactivated while signed in — treat
  // that as signed out rather than letting them into a half-broken app.
  const syncProfile = useCallback(async (next: Session | null) => {
    if (!next) {
      setProfile(null)
      return
    }
    try {
      const p = await fetchProfile(next.user.id)
      if (!p || !p.active) {
        await doSignOut()
        setProfile(null)
        setSession(null)
        return
      }
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      await syncProfile(data.session)
      if (!cancelled) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void syncProfile(next)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [syncProfile])

  const signIn = useCallback(async (empCode: string, pin: string) => {
    await doSignIn(empCode, pin)
    // onAuthStateChange picks up the session and loads the profile.
  }, [])

  const signOut = useCallback(async () => {
    await doSignOut()
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isManager: profile?.role === 'manager' || profile?.role === 'admin',
      signIn,
      signOut,
    }),
    [session, profile, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
