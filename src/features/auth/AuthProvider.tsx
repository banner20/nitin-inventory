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

  /**
   * Load the profile that belongs to a session.
   *
   * Two failures look identical from here and must not be treated alike. "The
   * database says this account is gone or deactivated" is a real answer, and
   * signing out is right. "The request didn't arrive" is not an answer at all
   * — and a phone in a cellar drops requests constantly. Treating the second
   * like the first threw people back to the login screen mid-shift, which is
   * how a system stops being used.
   *
   * So: a definite answer is obeyed, and a failure to get one is retried a
   * few times before giving up. Giving up keeps the session — the next auth
   * event or reload tries again — rather than throwing the shift away.
   */
  const syncProfile = useCallback(async (next: Session | null) => {
    if (!next) {
      setProfile(null)
      return
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const p = await fetchProfile(next.user.id)
        if (!p || !p.active) {
          await doSignOut()
          setProfile(null)
          setSession(null)
          return
        }
        setProfile(p)
        return
      } catch {
        // 400ms, then 800ms — long enough to outlast a handover between
        // cells, short enough that nobody watches a spinner over it.
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
        }
      }
    }
    // Couldn't reach the database. Say nothing and keep the session; the
    // guard will hold on the spinner and the next attempt may well work.
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
