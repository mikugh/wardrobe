import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches rendering errors so a bug shows a way out instead of a blank page. The wardrobe lives in
 * IndexedDB, not in React state, so reloading loses nothing that was saved.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Wardrobe crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-ink">
        <h1 className="font-display text-3xl">Something went wrong</h1>
        <p className="text-stone-600">
          The app hit an unexpected error. Your clothes, outfits and photos are saved on this device and are not affected.
        </p>
        <button
          onClick={() => location.reload()}
          className="h-12 rounded-full bg-accent px-6 font-medium text-white transition hover:bg-accent-dark"
        >
          Reload
        </button>
        <details className="text-sm text-stone-500">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
      </div>
    )
  }
}
