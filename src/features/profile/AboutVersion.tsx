import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { BUILD_INFO, buildLine, platformLabel } from '../../lib/buildInfo'
import { forceRefresh } from '../../lib/forceRefresh'
import { isAndroidApp, isNativeApp } from '../../lib/platform'
import { syncNow } from '../../lib/sync/engine'
import { checkForUpdate, RELEASES_PAGE, type UpdateInfo } from '../../lib/updates'
import { applyWebUpdate, checkWebUpdate, getWebUpdate, subscribeWebUpdate } from '../../lib/webUpdates'
import { timeAgo, useNow, useSyncStatus } from './useSyncStatus'

const linkClass = 'text-accent underline underline-offset-2 hover:text-text'

/**
 * Me → About: "FromZero 0.9.0 · a1b2c3d · 11 Nov · Web", last sync + Sync now, Check for
 * updates (new deploy on the web, new APK on Android), Force refresh (web only), privacy policy.
 */
export function AboutVersion() {
  const android = isAndroidApp()
  return (
    <div className="mt-3 space-y-3">
      {/* Not uppercase: the commit hash is case-sensitive. */}
      <p className="font-semibold text-text tabular-nums">
        {buildLine(BUILD_INFO, platformLabel())}
      </p>
      <SyncLine />
      {android ? <ApkUpdateCheck /> : isNativeApp() ? null : <WebUpdateCheck />}
      {!android && (
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

/** "Last synced 2 min ago · Sync now" (pull what changed, push what's waiting). */
function SyncLine() {
  const status = useSyncStatus()
  const now = useNow()
  const [busy, setBusy] = useState(false)

  if (status.state === 'off') {
    return <p className="text-muted">Not syncing. Sign in under Account to back up and sync your data.</p>
  }

  let text: string
  if (busy || status.state === 'syncing') text = 'Syncing…'
  else if (status.state === 'offline') text = 'Offline · syncs when you’re back online'
  else if (status.state === 'error') text = 'Sync error'
  else text = status.lastSyncedAt ? `Last synced ${timeAgo(status.lastSyncedAt, now)}` : 'Not synced yet'

  async function sync() {
    setBusy(true)
    try {
      await syncNow()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <p role="status" className="text-muted">
        {text}
        {status.pending > 0 && status.state !== 'syncing' && ` · ${status.pending} waiting to upload`}
      </p>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={busy || status.state === 'syncing'}
        className="min-h-touch font-display font-bold uppercase tracking-wider text-accent hover:text-text disabled:opacity-40"
      >
        Sync now
      </button>
    </div>
  )
}

/** Website / home-screen app: a new deploy (version.json + service worker), and Force refresh. */
function WebUpdateCheck() {
  const update = useSyncExternalStore(subscribeWebUpdate, getWebUpdate)
  const [status, setStatus] = useState<'idle' | 'checking' | 'latest' | 'offline' | 'updating' | 'refreshing'>('idle')

  async function check() {
    setStatus('checking')
    const result = await checkWebUpdate({ force: true })
    setStatus(result === 'update' ? 'idle' : result)
  }

  const busy = status === 'checking' || status === 'updating' || status === 'refreshing'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => void check()}>
          {status === 'checking' ? 'Checking…' : 'Check for updates'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setStatus('refreshing')
            void forceRefresh()
          }}
        >
          {status === 'refreshing' ? 'Refreshing…' : 'Force refresh'}
        </Button>
      </div>
      <div role="status" className="text-sm text-muted">
        {update.available ? (
          <p className="flex flex-wrap items-center gap-x-3">
            <span>New version available{update.remote ? ` (${update.remote.version})` : ''}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStatus('updating')
                void applyWebUpdate()
              }}
              className="min-h-touch font-display text-base font-bold uppercase tracking-wider text-accent hover:text-text disabled:opacity-40"
            >
              {status === 'updating' ? 'Updating…' : 'Update'}
            </button>
          </p>
        ) : (
          <>
            {status === 'latest' && <p>You’re on the latest version.</p>}
            {status === 'offline' && <p>No connection. Try again later.</p>}
          </>
        )}
        <p className="mt-1">Force refresh reloads the app’s files. Your data and sign-in stay.</p>
      </div>
    </div>
  )
}

/** Android app: the APK carries its own files, so only a new APK (GitHub Releases) updates it. */
function ApkUpdateCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'latest' | 'offline' | UpdateInfo>('idle')

  async function check() {
    setStatus('checking')
    const update = await checkForUpdate({ force: true }).catch(() => null)
    setStatus(update ?? (navigator.onLine ? 'latest' : 'offline'))
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={status === 'checking'} onClick={() => void check()}>
        {status === 'checking' ? 'Checking…' : 'Check for updates'}
      </Button>
      <p role="status" className="text-sm text-muted">
        {status === 'latest' && 'You’re on the latest version.'}
        {status === 'offline' && 'No connection. Try again later.'}
        {typeof status === 'object' && (
          <>
            Update available ({status.version}) ·{' '}
            <a href={status.downloadUrl} target="_blank" rel="noreferrer" className={linkClass}>
              Download
            </a>
          </>
        )}
      </p>
    </div>
  )
}
