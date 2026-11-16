import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isAndroidApp, isNativeApp } from '../lib/platform'
import { checkForUpdate, dismissUpdate, type UpdateInfo } from '../lib/updates'
import { applyWebUpdate, getWebUpdate, subscribeWebUpdate } from '../lib/webUpdates'

const buttonClass =
  'inline-flex min-h-touch items-center justify-center px-5 font-display text-base font-bold uppercase tracking-wider disabled:opacity-40'
const primaryClass = `${buttonClass} bg-accent text-on-accent hover:bg-text`
const secondaryClass = `${buttonClass} border border-panel-edge hover:border-accent hover:text-accent`

/**
 * "New version available · Update" (website and home-screen app: a new deploy is live,
 * lib/webUpdates.ts) or "Update available · Download" (Android app: a newer APK on GitHub
 * Releases, lib/updates.ts).
 */
export function UpdateBanner() {
  if (isAndroidApp()) return <ApkUpdateBanner />
  if (isNativeApp()) return null
  return <WebUpdateBanner />
}

function Banner({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <aside aria-label={title} className="mb-4 border border-panel-edge bg-panel">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1 basis-48">
          <p className="label text-accent">{title}</p>
          <p className="mt-1 text-muted">{children}</p>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </aside>
  )
}

function WebUpdateBanner() {
  const update = useSyncExternalStore(subscribeWebUpdate, getWebUpdate)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!update.available || hidden) return null
  return (
    <Banner
      title="New version available"
      actions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void applyWebUpdate()
            }}
            className={primaryClass}
          >
            {busy ? 'Updating…' : 'Update'}
          </button>
          <button type="button" disabled={busy} onClick={() => setHidden(true)} className={secondaryClass}>
            Later
          </button>
        </>
      }
    >
      {update.remote ? `FromZero ${update.remote.version} is ready.` : 'A newer FromZero is ready.'} Updating takes a second;
      your data stays.
    </Banner>
  )
}

/**
 * Android app: a newer APK on GitHub Releases. Download opens it in the phone's browser,
 * which installs it over this one (same signing key, so data stays).
 */
function ApkUpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    let live = true
    void checkForUpdate().then((u) => live && setUpdate(u))
    return () => {
      live = false
    }
  }, [])

  if (!update) return null
  return (
    <Banner
      title="Update available"
      actions={
        <>
          <a href={update.downloadUrl} target="_blank" rel="noreferrer" className={primaryClass}>
            Download
          </a>
          <button
            type="button"
            onClick={() => {
              dismissUpdate(update.version)
              setUpdate(null)
            }}
            className={secondaryClass}
          >
            Later
          </button>
        </>
      }
    >
      FromZero {update.version} is out. Your data stays when you install it.
    </Banner>
  )
}
