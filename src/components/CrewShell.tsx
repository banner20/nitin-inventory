import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/features/auth/AuthProvider'
import { IconHome, IconIn, IconOut, IconUser } from './icons'

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/out', label: 'Take out', Icon: IconOut, end: false },
  { to: '/in', label: 'Bring back', Icon: IconIn, end: false },
  { to: '/me', label: 'Me', Icon: IconUser, end: false },
]

/**
 * The crew app. Bottom navigation because this is used one-handed while
 * carrying something with the other hand.
 */
export default function CrewShell() {
  const { profile, isManager } = useAuth()

  const initials = (profile?.full_name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 px-4 h-14">
          <span
            aria-hidden="true"
            className="size-8 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center text-xs font-semibold"
          >
            {initials || '·'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {profile?.full_name ?? 'Loading…'}
            </p>
            <p className="text-xs text-fg-subtle truncate">{profile?.emp_code}</p>
          </div>
          {isManager && (
            <NavLink to="/admin" className="btn btn-ghost h-9 min-h-9 text-sm px-3">
              Admin
            </NavLink>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line">
        <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {tabs.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-brand-600' : 'text-fg-subtle hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* The active pill sits behind the icon rather than
                        recolouring the whole tab — at a glance the shape is
                        what reads, which survives sunlight and a cracked
                        screen better than a colour change alone. */}
                    <span
                      className={clsx(
                        'px-3.5 py-0.5 rounded-full transition-colors',
                        isActive ? 'bg-brand-50' : 'bg-transparent',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
