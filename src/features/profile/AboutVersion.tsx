import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { isAndroidApp } from '../../lib/platform'
import { checkForUpdate, installedVersion, RELEASES_PAGE, type UpdateInfo } from '../../lib/updates'

const linkClass = 'text-accent underline underline-offset-2 hover:text-text'

/** Me → About: version, update check (Android app) or app download link (website), privacy policy. */
export function AboutVersion() {
  const android = isAndroidApp()
  const [version, setVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'checking' | 'latest' | 'failed' | UpdateInfo>('idle')

  useEffect(() => {
    let live = true
    void installedVersion().then((v) => live && setVersion(v))
    return () => {
      live = false
    }
  }, [])

  const check = async () => {
    setStatus('checking')
    const update = await checkForUpdate({ force: true }).catch(() => null)
    setStatus(update ?? (navigator.onLine ? 'latest' : 'failed'))
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-muted">
        Version <span className="font-semibold text-text tabular-nums">{version ?? '…'}</span>
        {android ? ' · Android app' : ''}
      </p>
      {android ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={status === 'checking'} onClick={() => void check()}>
            Check for updates
          </Button>
          <p role="status" className="text-sm text-muted">
            {status === 'latest' && 'You have the latest version.'}
            {status === 'failed' && 'No connection. Try again later.'}
            {typeof status === 'object' && (
              <>
                {status.version} is out.{' '}
                <a href={status.downloadUrl} target="_blank" rel="noreferrer" className={linkClass}>
                  Download
                </a>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-muted">
          On Android?{' '}
          <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className={linkClass}>
            Get the app
          </a>{' '}
          for steps and sleep from Health Connect.
        </p>
      )}
      <p>
        <Link to="/privacy" className={linkClass}>
          Privacy policy
        </Link>
      </p>
    </div>
  )
}
