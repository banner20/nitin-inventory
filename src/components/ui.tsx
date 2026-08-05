import type { ReactNode } from 'react'

/**
 * The handful of shapes that repeat on every screen. Extracted so a page
 * header on Events and a page header on People can't drift apart by a
 * font-weight — consistency here is what makes the console feel like one
 * product rather than six pages built on six afternoons.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-fg-muted mt-0.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  count,
  description,
}: {
  title: string
  count?: number
  description?: ReactNode
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold flex items-center gap-2">
        {title}
        {count !== undefined && count > 0 && (
          <span className="badge badge-neutral tabular">{count}</span>
        )}
      </h2>
      {description && <p className="text-sm text-fg-muted mt-0.5">{description}</p>}
    </div>
  )
}

/**
 * Empty states carry the next action rather than just reporting absence —
 * "no events yet" is a dead end, "no events yet, here's the button" isn't.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-sm text-fg-muted mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Inline "still loading" text, so it reads the same everywhere. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="text-sm text-fg-subtle" role="status">
      {label}
    </p>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-bad-600" role="alert">
      {children}
    </p>
  )
}

/**
 * A number with its label beneath — the summary row above the master sheet.
 * `tone` colours only the figure, so a row of stats stays scannable and the
 * one that needs attention is the one that's coloured.
 */
export function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  tone?: 'neutral' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'bad' ? 'text-bad-600' : tone === 'warn' ? 'text-warn-600' : 'text-fg'
  return (
    <div className="card px-4 py-3">
      <p className={`text-xl font-semibold tabular ${toneClass}`}>{value}</p>
      <p className="text-xs text-fg-muted mt-0.5">{label}</p>
    </div>
  )
}
