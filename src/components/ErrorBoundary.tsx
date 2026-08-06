import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The last line of defence. Without one of these, a single bad render — one
 * unexpected null from the database, one typo in a rarely-hit branch — is a
 * white screen with no way out but knowing to refresh. On a phone, mid-service,
 * that reads as "the app is broken" and the count goes back to paper.
 *
 * React only lets a class component catch render errors, so this stays a class.
 */
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nowhere to send this yet, but the console is where anyone debugging on a
    // real device will look first.
    console.error('Something broke while rendering:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-canvas">
        <div className="card p-6 max-w-md w-full space-y-4 text-center">
          <p className="text-4xl" aria-hidden="true">
            🍸
          </p>
          <div>
            <h1 className="text-lg font-semibold">Well, that's spilled</h1>
            <p className="text-sm text-fg-muted mt-1">
              Something broke on this screen. Nothing you'd entered was saved, so
              nothing's been counted wrong — it just needs a reload.
            </p>
          </div>

          <div className="flex gap-2 justify-center">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <Link to="/" className="btn btn-ghost" onClick={() => this.setState({ error: null })}>
              Go home
            </Link>
          </div>

          {/* The message, folded away. Useless to most people and essential to
              whoever has to fix it. */}
          <details className="text-left">
            <summary className="text-xs text-fg-subtle cursor-pointer">
              What went wrong
            </summary>
            <pre className="mt-2 text-[11px] text-fg-muted bg-surface-sunken rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </main>
    )
  }
}
