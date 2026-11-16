/**
 * Me → Force refresh (website and home-screen app only): unregister the service worker,
 * delete the app's cached files (Cache Storage) and reload from the network.
 *
 * It must never touch the user's data: IndexedDB (Dexie, where everything logged lives,
 * and Firebase's sign-in) and localStorage are left alone. forceRefresh.test.ts proves it.
 */
export async function forceRefresh({ reload = () => window.location.reload() } = {}): Promise<void> {
  await unregisterServiceWorkers()
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch {
    // Cache Storage unavailable: the reload still fetches fresh files once the worker is gone.
  }
  reload()
}

/** Remove every service worker registered for this site (also used in the Android app, which must have none). */
export async function unregisterServiceWorkers(): Promise<void> {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(registrations.map((r) => r.unregister()))
  } catch {
    // No service worker support: nothing to remove.
  }
}
