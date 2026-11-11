import { useEffect, useState } from 'react'
import { checkForUpdate, dismissUpdate, type UpdateInfo } from '../lib/updates'

/**
 * Android app only: "Update available" when GitHub Releases has a newer APK
 * (lib/updates.ts). Download opens the APK in the phone's browser, which installs it
 * over this one (same signing key, so data stays). Nothing shows on the website.
 */
export function UpdateBanner() {
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
    <aside aria-label="Update available" className="mb-4 border border-panel-edge bg-panel">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1 basis-48">
          <p className="label text-accent">Update available</p>
          <p className="mt-1 text-muted">FromZero {update.version} is out. Your data stays when you install it.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={update.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-touch items-center justify-center bg-accent px-5 font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text"
          >
            Download
          </a>
          <button
            type="button"
            onClick={() => {
              dismissUpdate(update.version)
              setUpdate(null)
            }}
            className="inline-flex min-h-touch items-center justify-center border border-panel-edge px-5 font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
          >
            Later
          </button>
        </div>
      </div>
    </aside>
  )
}
