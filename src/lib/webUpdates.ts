/**
 * Updates for the website and the iPhone/Android home-screen app (the PWA).
 *
 * Every push to main deploys a new build; the service worker keeps serving the old files
 * until the new worker takes over. When the app opens or comes back into view we fetch
 * `/version.json` (never cached) and ask the service worker to look for a new version.
 * A newer build shows "New version available · Update" (app/UpdateBanner.tsx); Update
 * activates the waiting worker and reloads.
 *
 * The Android app is different: it carries its own copy of these files, so website deploys
 * never reach it. It registers no service worker and checks GitHub Releases (lib/updates.ts).
 */
import { BUILD_INFO, isNewerBuild, parseBuildInfo, type BuildInfo } from './buildInfo'
import { unregisterServiceWorkers } from './forceRefresh'
import { isNativeApp } from './platform'

export interface WebUpdateState {
  /** A newer build is live (version.json) or already downloaded (waiting worker). */
  available: boolean
  /** The new service worker is installed and waiting for Update. */
  waiting: boolean
  /** The live build, when version.json told us. */
  remote?: BuildInfo
}

/** Coming back into view checks at most this often. "Check for updates" always checks. */
export const CHECK_EVERY_MS = 60_000
/** Update waits this long for the new worker to finish downloading before reloading anyway. */
const WAIT_FOR_WORKER_MS = 15_000

let state: WebUpdateState = { available: false, waiting: false }
const listeners = new Set<() => void>()

function setState(next: Partial<WebUpdateState>): void {
  state = { ...state, ...next }
  listeners.forEach((fn) => fn())
}

export function getWebUpdate(): WebUpdateState {
  return state
}

export function subscribeWebUpdate(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let started = false
let lastCheck = 0
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined
let registration: ServiceWorkerRegistration | undefined

/** main.tsx: register the service worker (website only) and check on open and on every return. */
export function startWebUpdates(): void {
  if (started) return
  started = true
  if (isNativeApp()) {
    // The APK ships its own files and must never run a service worker.
    void unregisterServiceWorkers()
    return
  }
  // Loaded here, not at the top, so screens that only read the update state don't pull it in.
  void import('virtual:pwa-register').then(({ registerSW }) => {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => setState({ waiting: true, available: true }),
      onRegisteredSW: (_url, r) => {
        registration = r
      },
    })
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkWebUpdate()
  })
  // iPhone restores home-screen apps from the back/forward cache without a visibility change.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void checkWebUpdate()
  })
  void checkWebUpdate({ force: true })
}

export type WebCheckResult = 'update' | 'latest' | 'offline'

/**
 * Is a newer build out? Fetches `/version.json` past every cache and asks the service worker
 * to check `sw.js` (it then downloads the new files in the background).
 */
export async function checkWebUpdate({ force = false, now = Date.now(), fetchFn = fetch } = {}): Promise<WebCheckResult> {
  if (isNativeApp()) return 'latest'
  if (!force && now - lastCheck < CHECK_EVERY_MS) return state.available ? 'update' : 'latest'
  lastCheck = now

  const workerCheck = registration?.update().catch(() => undefined)
  let reached = true
  try {
    const res = await fetchFn(`/version.json?t=${now}`, { cache: 'no-store' })
    // An old deploy has no version.json and answers with the app page instead: not JSON, ignored.
    const remote = res.ok ? parseBuildInfo(await res.json().catch(() => null)) : null
    if (remote && isNewerBuild(remote, BUILD_INFO)) setState({ available: true, remote })
  } catch {
    reached = false
  }
  await workerCheck
  if (state.available) return 'update'
  return reached ? 'latest' : 'offline'
}

/** "Update": switch to the new version and reload. */
export async function applyWebUpdate({ reload = () => window.location.reload(), waitMs = WAIT_FOR_WORKER_MS } = {}): Promise<void> {
  if (!state.waiting && registration) {
    // version.json knows before the worker has finished downloading: give it a moment.
    await registration.update().catch(() => undefined)
    await waitFor(() => state.waiting, waitMs)
  }
  if (state.waiting && updateSW) {
    // The new worker takes over and registerSW reloads; reload anyway if that doesn't happen.
    await updateSW(true)
    setTimeout(reload, 4000)
    return
  }
  // No service worker (or it never arrived): a plain reload gets index.html fresh (no-cache).
  reload()
}

function waitFor(done: () => boolean, ms: number): Promise<void> {
  if (done()) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      unsubscribe()
      resolve()
    }
    const timer = setTimeout(finish, ms)
    const unsubscribe = subscribeWebUpdate(() => {
      if (done()) finish()
    })
  })
}
