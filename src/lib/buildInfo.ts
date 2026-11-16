/**
 * What this build is: package.json's version, the short git commit and the build time,
 * injected by vite.config.ts (which also writes the same info to `/version.json`).
 * package.json is the only place the version lives; the APK's versionName and versionCode
 * come from it too (android/app/build.gradle).
 */
import { isAndroidApp } from './platform'

export interface BuildInfo {
  version: string
  /** Short git commit ("a1b2c3d"). */
  commit: string
  /** ISO time the build was made. */
  builtAt: string
}

export const BUILD_INFO: BuildInfo = __BUILD_INFO__

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

/**
 * True when `remote` (the live `/version.json`) is a newer build than `local`: a higher
 * version, or the same version deployed again from a later commit.
 */
export function isNewerBuild(remote: BuildInfo, local: BuildInfo): boolean {
  const byVersion = compareVersions(remote.version, local.version)
  if (byVersion !== 0) return byVersion > 0
  if (remote.commit === local.commit) return false
  const a = Date.parse(remote.builtAt)
  const b = Date.parse(local.builtAt)
  return Number.isFinite(a) && Number.isFinite(b) && a > b
}

/** A `/version.json` body, or null when it isn't one (e.g. the HTML page an old deploy rewrites to). */
export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object') return null
  const { version, commit, builtAt } = value as Record<string, unknown>
  if (typeof version !== 'string' || typeof commit !== 'string' || typeof builtAt !== 'string') return null
  return { version, commit, builtAt }
}

export type PlatformLabel = 'Web' | 'Android'

export function platformLabel(): PlatformLabel {
  return isAndroidApp() ? 'Android' : 'Web'
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** "FromZero 0.9.0 · a1b2c3d · 11 Nov · Web" (the date in local time). */
export function buildLine(info: BuildInfo, platform: PlatformLabel): string {
  const built = new Date(info.builtAt)
  const date = Number.isNaN(built.getTime()) ? null : dayMonth.format(built)
  return ['FromZero ' + info.version, info.commit, date, platform].filter(Boolean).join(' · ')
}
