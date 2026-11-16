/**
 * The rest timer. Its end time is kept in device-only meta (never synced), so
 * a refresh or reopening the app keeps counting. Alerts use Web Audio and the
 * Vibration API where available.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getMeta, setMeta } from '../../../lib/db'
import { isNativeApp } from '../../../lib/platform'

const KEY = 'restTimer'
export const ADJUST_SECONDS = 15
/** An alert that would come later than this after the end (app was closed) is skipped. */
const STALE_MS = 5_000

export interface RestTimer {
  endsAt: number
  /** Full length in seconds (for the progress bar). */
  total: number
  /** What the rest follows, e.g. "Barbell Squat". */
  label: string
}

export function getRestTimer(): Promise<RestTimer | undefined> {
  return getMeta<RestTimer>(KEY)
}

export async function startRest(seconds: number, label: string, now = Date.now()): Promise<void> {
  primeAudio()
  if (seconds <= 0) return skipRest()
  await setMeta(KEY, { endsAt: now + seconds * 1000, total: seconds, label } satisfies RestTimer)
}

/** +15 s / −15 s. Never goes below "now". */
export async function adjustRest(deltaSeconds: number, now = Date.now()): Promise<void> {
  const t = await getRestTimer()
  if (!t) return
  const endsAt = Math.max(now, t.endsAt + deltaSeconds * 1000)
  await setMeta(KEY, { ...t, endsAt, total: Math.max(t.total + deltaSeconds, Math.ceil((endsAt - now) / 1000), 1) })
}

export function skipRest(): Promise<void> {
  return setMeta(KEY, undefined)
}

// ---- Alerts -----------------------------------------------------------------------

let audio: AudioContext | undefined

/** Create / resume the audio context during a tap, so the end beep may play later. */
function primeAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = undefined
  }
}

/** Three short beeps and a buzz. */
export function restAlert(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Not supported: fine.
  }
  if (!audio) return
  const t0 = audio.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.25)
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.25 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.25 + 0.15)
    osc.connect(gain).connect(audio.destination)
    osc.start(t0 + i * 0.25)
    osc.stop(t0 + i * 0.25 + 0.16)
  }
}

// ---- Hooks ---------------------------------------------------------------------------

/** Current time, updated every `ms` while `active`. */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms, active])
  return now
}

/** The running timer and seconds left; alerts and clears itself at zero. */
export function useRestTimer(): { timer: RestTimer | undefined; left: number } {
  const timer = useLiveQuery(getRestTimer, [])
  const now = useNow(250, !!timer)
  // `now` can lag a tick behind a timer that just started: never show more than its length.
  const left = timer ? Math.min(timer.total, Math.max(0, Math.ceil((timer.endsAt - now) / 1000))) : 0

  useEffect(() => {
    if (!timer || left > 0) return
    if (Date.now() - timer.endsAt < STALE_MS) restAlert()
    void skipRest()
  }, [timer, left])

  return { timer, left }
}

/**
 * Keep the screen on while `active`. Website/PWA: Screen Wake Lock API, re-taken when the
 * tab comes back. Android app: the native keep-awake plugin (the WebView has no Wake Lock API).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !isNativeApp()) return
    const plugin = import('@capacitor-community/keep-awake').then(({ KeepAwake }) => KeepAwake)
    void plugin.then((k) => k.keepAwake()).catch(() => {})
    return () => void plugin.then((k) => k.allowSleep()).catch(() => {})
  }, [active])

  useEffect(() => {
    if (!active || isNativeApp() || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let stopped = false
    const request = () => {
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (stopped) void l.release()
          else lock = l
        },
        () => {
          // Denied (battery saver, unsupported): the session still works.
        },
      )
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
