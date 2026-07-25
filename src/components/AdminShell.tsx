import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  IconAlert,
  IconBox,
  IconCalendar,
  IconLogout,
  IconSearch,
  IconUsers,
} from './icons'

const nav = [
  { to: '/admin', label: 'Master sheet', Icon: IconBox, end: true },
  { to: '/admin/search', label: 'Search', Icon: IconSearch, end: false },
  { to: '/admin/conflicts', label: 'Conflicts', Icon: IconAlert, end: false },
  { to: '/admin/events', label: 'Events', Icon: IconCalendar, end: false },
  { to: '/admin/people', label: 'People', Icon: IconUsers, end: false },
]

/**
 * The desktop console. Same codebase as the crew app, laid out for a full
 * screen and a mouse — this is where the master sheet and every decision that
 * needs a human live.
 */
export default function AdminShell() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh grid grid-cols-[15rem_1fr] max-lg:grid-cols-1">
      <aside className="border-r border-ink-800 bg-ink-900 flex flex-col max-lg:hidden">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-ink-800">
          <img src="/icon.svg" alt="" className="size-7" />
          <span className="font-semibold text-white">Inventory</span>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {nav.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-ink-800 text-white'
                        : 'text-ink-400 hover:text-ink-200 hover:bg-ink-850',
                    )
                  }
                >
                  <Icon className="size-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-ink-800 space-y-1">
          <NavLink to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-400 hover:text-ink-200 hover:bg-ink-850">
            <IconBox className="size-5" />
            Crew view
          </NavLink>
          <div className="px-3 py-2">
            <p className="text-sm text-white truncate">{profile?.full_name}</p>
            <p className="text-xs text-ink-600 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-400 hover:text-ink-200 hover:bg-ink-850"
          >
            <IconLogout className="size-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Narrow screens get a simple top bar instead of the sidebar. */}
      <div className="lg:hidden border-b border-ink-800 bg-ink-900 px-4 h-14 flex items-center gap-4 overflow-x-auto">
        {nav.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'text-sm font-medium whitespace-nowrap',
                isActive ? 'text-brand-400' : 'text-ink-400',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <main className="min-w-0 p-6 max-lg:p-4">
        <Outlet />
      </main>
    </div>
  )
}
