import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  IconAlert,
  IconBox,
  IconCalendar,
  IconClock,
  IconIn,
  IconLogout,
  IconUsers,
} from './icons'

/**
 * Grouped rather than one flat list: the first group is the daily work, the
 * second is the things you set up once and revisit. Six undifferentiated
 * links all read as equally likely; two labelled groups say which is which.
 */
const navGroups: {
  heading: string
  items: { to: string; label: string; Icon: typeof IconBox; end: boolean }[]
}[] = [
  {
    heading: 'Stock',
    items: [
      { to: '/admin', label: 'Master sheet', Icon: IconBox, end: true },
      { to: '/admin/stock-in', label: 'Add stock', Icon: IconIn, end: false },
      { to: '/admin/conflicts', label: 'Conflicts', Icon: IconAlert, end: false },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/admin/events', label: 'Events', Icon: IconCalendar, end: false },
      { to: '/admin/history', label: 'History', Icon: IconClock, end: false },
      { to: '/admin/people', label: 'People', Icon: IconUsers, end: false },
    ],
  },
]

const allItems = navGroups.flatMap((g) => g.items)

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-fg-muted hover:text-fg hover:bg-surface-hover',
  )

/**
 * The desktop console. Same codebase as the crew app, laid out for a full
 * screen and a mouse — this is where the master sheet and every decision that
 * needs a human live.
 */
export default function AdminShell() {
  const { profile, signOut } = useAuth()

  const initials = (profile?.full_name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="min-h-dvh grid grid-cols-[15rem_1fr] max-lg:grid-cols-1 bg-canvas">
      {/* Pinned to the viewport, not the page. Without this the sidebar grows
          to match however tall the master sheet is, which pushes Crew view and
          Sign out hundreds of pixels below the fold — you had to scroll a
          124-row table to reach them. The nav scrolls inside instead. */}
      <aside className="border-r border-line bg-surface flex flex-col max-lg:hidden sticky top-0 h-dvh">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-line">
          <img src="/icon.svg" alt="" className="size-6" />
          <span className="font-semibold text-sm">Inventory</span>
        </div>

        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.heading}>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, label, Icon, end }) => (
                  <li key={to}>
                    <NavLink to={to} end={end} className={linkClass}>
                      <Icon className="size-4 shrink-0" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line space-y-0.5">
          <NavLink to="/" className={() => linkClass({ isActive: false })}>
            <IconBox className="size-4 shrink-0" />
            Crew view
          </NavLink>

          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span
              aria-hidden="true"
              className="size-7 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center text-[11px] font-semibold"
            >
              {initials || '·'}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{profile?.full_name}</span>
              <span className="block text-xs text-fg-subtle capitalize">{profile?.role}</span>
            </span>
          </div>

          <button
            onClick={() => void signOut()}
            className={'w-full ' + linkClass({ isActive: false })}
          >
            <IconLogout className="size-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Narrow screens get a scrolling tab strip instead of the sidebar. */}
      <div className="lg:hidden sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur px-2 h-14 flex items-center gap-1 overflow-x-auto">
        {allItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-fg-muted',
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
