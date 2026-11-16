import { useSyncExternalStore } from 'react'

function subscribe(fn: () => void): () => void {
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => {
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
  }
}

const isOffline = () => !navigator.onLine

/** Thin strip while the device has no connection. Logging keeps working: it's all on the device. */
export function OfflineBanner() {
  const offline = useSyncExternalStore(subscribe, isOffline, () => false)
  return (
    <div role="status" aria-live="polite">
      {offline && (
        <p className="mb-4 border-l-2 border-accent bg-panel px-3 py-2 text-sm text-muted">
          <span className="label mr-2 text-accent">Offline</span>
          Everything you log still saves on this device. Packaged-food search and sync wait until you’re back online.
        </p>
      )}
    </div>
  )
}
