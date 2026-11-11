/**
 * In-app update check for the Android app. There's no Play Store: new APKs are
 * published as GitHub Releases of the (public) app repository, and the app looks
 * at the latest one through the public GitHub API when it starts.
 *
 * Tags are versions (`v0.2.0`), in step with package.json and the APK's versionName.
 * The release's `.apk` asset is the download; without one, the release page is.
 */
import { App } from '@capacitor/app'
import { isAndroidApp } from './platform'

export const RELEASES_REPO = 'Zenithyr-boop/Dailyapp'
/** The latest release, for people (the website links here to get the app). */
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`
const LATEST_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`

/** Check at most this often (unauthenticated GitHub API calls are limited to 60 an hour per IP). */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/** The version of this build (package.json, injected by vite.config.ts). */
export const BUILD_VERSION: string = __APP_VERSION__

export interface UpdateInfo {
  version: string
  /** The APK (or the release page when the release has no APK). */
  downloadUrl: string
  pageUrl: string
}

/** Parse "v1.2.3" / "1.2.3-beta" into numbers; missing parts are 0. */
function parts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0)
}

/** > 0 when `a` is newer than `b`, < 0 when older, 0 when the same. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

interface GithubRelease {
  tag_name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  assets?: { name?: string; browser_download_url?: string }[]
}

/** The latest release if it's newer than `current`, else null. Throws on network errors. */
export async function fetchUpdate(current: string, fetchFn: typeof fetch = fetch): Promise<UpdateInfo | null> {
  const res = await fetchFn(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
  if (res.status === 404) return null // no release yet
  if (!res.ok) throw new Error(`GitHub releases: HTTP ${res.status}`)
  const release = (await res.json()) as GithubRelease
  if (!release.tag_name || release.draft || release.prerelease) return null
  if (compareVersions(release.tag_name, current) <= 0) return null
  const pageUrl = release.html_url ?? RELEASES_PAGE
  const apk = release.assets?.find((a) => a.name?.toLowerCase().endsWith('.apk') && a.browser_download_url)
  return { version: release.tag_name.replace(/^v/i, ''), downloadUrl: apk?.browser_download_url ?? pageUrl, pageUrl }
}

/** The installed app's version (the APK's versionName), or this build's on the web. */
export async function installedVersion(): Promise<string> {
  if (!isAndroidApp()) return BUILD_VERSION
  try {
    return (await App.getInfo()).version
  } catch {
    return BUILD_VERSION
  }
}

// Device-only bookkeeping in localStorage (it may be unavailable; then we just check every launch).
const CHECKED_KEY = 'fromzero.updateCheck'
const DISMISSED_KEY = 'fromzero.updateDismissed'

interface Checked {
  at: number
  update: UpdateInfo | null
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: fine.
  }
}

/**
 * Android app only: the update to offer, or null. Uses the last answer for a few
 * hours, skips a version the user said "Later" to, and stays quiet offline.
 */
export async function checkForUpdate({ force = false, now = Date.now(), fetchFn = fetch } = {}): Promise<UpdateInfo | null> {
  if (!isAndroidApp()) return null
  const current = await installedVersion()
  const cached = read<Checked>(CHECKED_KEY)
  let update: UpdateInfo | null
  if (!force && cached && now - cached.at < CHECK_EVERY_MS) {
    update = cached.update
  } else {
    try {
      update = await fetchUpdate(current, fetchFn)
    } catch {
      return null
    }
    write(CHECKED_KEY, { at: now, update } satisfies Checked)
  }
  if (!update || compareVersions(update.version, current) <= 0) return null
  if (!force && read<string>(DISMISSED_KEY) === update.version) return null
  return update
}

/** "Later": don't show this version again (a newer one still shows). */
export function dismissUpdate(version: string): void {
  write(DISMISSED_KEY, version)
}
