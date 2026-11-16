import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { feedbackUrl } from '../lib/feedback'
import { forceRefresh } from '../lib/forceRefresh'
import { isNativeApp } from '../lib/platform'

const buttonClass =
  'inline-flex min-h-touch items-center justify-center px-5 font-display text-base font-bold uppercase tracking-wider'
const linkClass = 'text-accent underline underline-offset-2 hover:text-text'

/** A lazily loaded file from an older deploy is gone (the site was updated while open). */
function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(message)
}

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * The screen shown when a page crashes. `inShell`: inside the app shell (the tab bar
 * still works); otherwise full screen. Data is never touched: Reload just reloads.
 */
export function RouteError({ inShell = false }: { inShell?: boolean }) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const stale = isStaleChunkError(error)
  const details = errorText(error)

  const title = notFound ? 'Page not found' : stale ? 'FromZero was updated' : 'Something went wrong'
  const body = notFound
    ? 'That page doesn’t exist.'
    : stale
      ? 'A new version came out while the app was open. Reload to get it.'
      : 'This screen hit a problem and couldn’t show. Your data is safe: everything you logged is still on this device.'

  const content = (
    <section aria-labelledby="error-title" role="alert" className="border border-panel-edge bg-panel">
      <header className="flex min-h-11 items-center border-b border-line-soft px-4">
        <h1 id="error-title" className="label">
          {title}
        </h1>
      </header>
      <div className="space-y-4 p-4">
        <p className="text-text">{body}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => window.location.reload()} className={`${buttonClass} bg-accent text-on-accent hover:bg-text`}>
            Reload
          </button>
          <a href="/quests" className={`${buttonClass} border border-panel-edge hover:border-accent hover:text-accent`}>
            Go to Quests
          </a>
        </div>
        {!notFound && (
          <>
            {!isNativeApp() && (
              <p className="text-sm text-muted">
                Still stuck after reloading?{' '}
                <button type="button" onClick={() => void forceRefresh()} className={`min-h-touch ${linkClass}`}>
                  Force refresh
                </button>{' '}
                reloads the app’s files and keeps your data and sign-in.
              </p>
            )}
            <p className="text-sm text-muted">
              If it keeps happening,{' '}
              <a href={feedbackUrl(`Error: ${details}`)} target="_blank" rel="noreferrer" className={linkClass}>
                send feedback
              </a>{' '}
              so it can be fixed.
            </p>
            <details className="text-sm text-muted">
              <summary className="min-h-touch cursor-pointer py-2">Error details</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-line p-3 font-mono text-xs">{details}</pre>
            </details>
          </>
        )}
      </div>
    </section>
  )

  if (inShell) return content
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Link to="/quests" className="mb-4 inline-flex min-h-touch items-center font-display text-2xl font-extrabold uppercase">
        FromZero
      </Link>
      {content}
    </main>
  )
}
