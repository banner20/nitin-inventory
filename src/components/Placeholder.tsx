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
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="badge badge-warn uppercase tracking-wide">{milestone}</span>
      </div>
      <p className="text-sm text-fg-muted">
        {children ?? 'Not built yet.'}
      </p>
    </div>
  )
}
