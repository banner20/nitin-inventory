import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

function FullScreenSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div
        className="size-8 rounded-full border-2 border-line border-t-brand-500 animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}

/** Requires a signed-in user with an active profile. */
export function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!session || !profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/**
 * Manager/admin only. The database enforces this too via RLS — this guard
 * just avoids showing a console that would fail every query.
 */
export function RequireManager() {
  const { isManager, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!isManager) return <Navigate to="/" replace />
  return <Outlet />
}
