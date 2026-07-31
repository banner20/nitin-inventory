import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/features/auth/AuthProvider'
import { IconHome, IconIn, IconOut, IconUser, IconUsers } from './icons'

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/out', label: 'Take out', Icon: IconOut, end: false },
  { to: '/in', label: 'Bring back', Icon: IconIn, end: false },
  { to: '/everyone', label: 'Everyone', Icon: IconUsers, end: false },
  { to: '/me', label: 'Me', Icon: IconUser, end: false },
]

/**
 * The crew app. Bottom navigation because this is used one-handed while
 * carrying something with the other hand.
 */
export default function CrewShell() {
  const { profile, isManager } = useAuth()

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 bg-ink-950/90 backdrop-blur border-b border-ink-800">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.full_name ?? 'Loading…'}
            </p>
            <p className="text-xs text-ink-400 truncate">{profile?.emp_code}</p>
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

      <nav className="fixed bottom-0 inset-x-0 bg-ink-900/95 backdrop-blur border-t border-ink-800">
        <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {tabs.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors',
                    isActive ? 'text-brand-400' : 'text-ink-400 hover:text-ink-200',
                  )
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
