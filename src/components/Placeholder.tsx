/**
 * Explicit "not built yet" marker. Deliberately not fake data — a screen that
 * looks finished but isn't is worse than an empty one.
 */
export default function Placeholder({
  title,
  milestone,
  children,
}: {
  title: string
  milestone: string
  children?: React.ReactNode
}) {
  return (
    <div className="card p-6 space-y-2 max-w-xl">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-[11px] uppercase tracking-wide font-semibold text-ink-950 bg-warn-500 rounded px-1.5 py-0.5">
          {milestone}
        </span>
      </div>
      <p className="text-sm text-ink-400">
        {children ?? 'Not built yet.'}
      </p>
    </div>
  )
}
