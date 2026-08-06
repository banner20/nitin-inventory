import { Link } from 'react-router-dom'

/**
 * A wrong URL used to bounce silently to the home screen, which is indis-
 * tinguishable from the app losing your place. Saying so is friendlier than
 * pretending nothing happened.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-canvas">
      <div className="card p-6 max-w-md w-full space-y-4 text-center">
        <p className="text-4xl" aria-hidden="true">
          🔎
        </p>
        <div>
          <h1 className="text-lg font-semibold">Nothing on this shelf</h1>
          <p className="text-sm text-fg-muted mt-1">
            That page doesn't exist. It may have been renamed, or the link was
            typed a little wrong.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Link to="/" className="btn btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
