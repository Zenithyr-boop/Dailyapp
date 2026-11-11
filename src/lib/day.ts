/**
 * The one source of "today" for every feature.
 *
 * A day key is `YYYY-MM-DD` in the user's local time zone. The day starts at
 * the user's `dayStartHour` (profile setting, 0–4, unset = midnight): with a
 * 4 AM start, 00:30 on the 11th still belongs to day `…-10`.
 *
 * Day keys are worked out from the local calendar date and hour, never by
 * adding milliseconds, so daylight-saving nights (23 or 25 hours long) are safe.
 *
 * Screens use `useToday()` / `useDayClock()`; data code uses `await getToday()`.
 * The clock re-checks the real time when the app opens, comes back into view,
 * regains focus, and once a minute, so a paused or early timer can't leave the
 * app on yesterday (phones pause timers while the screen is off).
 */
import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from './db'

/** Hours the day may start at (0 = midnight). */
export const DAY_START_HOURS = [0, 1, 2, 3, 4] as const
export type DayStartHour = (typeof DAY_START_HOURS)[number]
export const DEFAULT_DAY_START: DayStartHour = 0

/** Clamp anything stored on a profile into a valid day-start hour. */
export function normalizeDayStart(hour: unknown): DayStartHour {
  return (DAY_START_HOURS as readonly unknown[]).includes(hour) ? (hour as DayStartHour) : DEFAULT_DAY_START
}

/** "Midnight", "1 AM" … "4 AM" (localised hour). */
export function dayStartLabel(hour: DayStartHour): string {
  if (hour === 0) return 'Midnight'
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2026, 0, 1, hour))
}

// ---------------------------------------------------------------- key maths

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && KEY.test(value)
}

/** The plain calendar date of a moment as `YYYY-MM-DD` (ignores the day-start hour). */
export function calendarKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a `YYYY-MM-DD` key into a Date at local midnight (for display). */
export function fromDayKey(key: string): Date {
  const match = KEY.exec(key)
  if (!match) throw new Error(`invalid day key: ${key}`)
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Add whole days to a day key (month/year/DST safe). */
export function addDays(key: string, days: number): string {
  const date = fromDayKey(key)
  date.setDate(date.getDate() + days)
  return calendarKey(date)
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  // Noon avoids DST hours; rounding absorbs the 1-hour difference anyway.
  const noon = (k: string) => fromDayKey(k).getTime() + 12 * 3_600_000
  return Math.round((noon(b) - noon(a)) / 86_400_000)
}

/** The `YYYY-MM` month of a day key. */
export const monthOf = (key: string) => key.slice(0, 7)

/** Move a `YYYY-MM` month by `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  return calendarKey(new Date(y!, m! - 1 + n, 1)).slice(0, 7)
}

/** Every day key of a `YYYY-MM` month. */
export function daysOfMonth(month: string): string[] {
  const out: string[] = []
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) out.push(d)
  return out
}

/** The day a moment belongs to, given the hour the day starts at. */
export function dayKeyAt(at: Date | number = Date.now(), startHour: number = DEFAULT_DAY_START): string {
  const date = new Date(at)
  const key = calendarKey(date)
  return date.getHours() < startHour ? addDays(key, -1) : key
}

/** The moment day `key` starts (local time). A start hour skipped by DST rolls forward, as JS dates do. */
export function dayStartTime(key: string, startHour: number = DEFAULT_DAY_START): number {
  const date = fromDayKey(key)
  date.setHours(startHour, 0, 0, 0)
  return date.getTime()
}

/** Milliseconds until the next day starts. */
export function msUntilNextDay(at: Date | number = Date.now(), startHour: number = DEFAULT_DAY_START): number {
  const now = new Date(at).getTime()
  return dayStartTime(addDays(dayKeyAt(now, startHour), 1), startHour) - now
}

/** "9h 42m", "42m", "<1m" (whole minutes left, rounded down). */
export function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** A `?date=` value as a day to show: a valid key no later than today, else today. */
export function clampDay(value: string | null | undefined, today: string): string {
  return isDayKey(value) && value <= today ? value : today
}

const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/** "Today", "Yesterday", else "Mon 9 Nov". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return shortDate.format(fromDayKey(date))
}

/** "Monday 9 November". */
export function longDayLabel(date: string): string {
  return longDate.format(fromDayKey(date))
}

/** Quests can be changed today and yesterday (one day's grace), never in the future. */
export function canEditQuests(date: string, today: string): boolean {
  return date === today || date === addDays(today, -1)
}

// ---------------------------------------------------------------- today

/** The user's day-start hour, from the profile on this device. */
export async function getDayStartHour(): Promise<DayStartHour> {
  return normalizeDayStart((await db.profile.get('me'))?.dayStartHour)
}

/** Today's key, using the user's day-start hour. Use this in data code. */
export async function getToday(now: number = Date.now()): Promise<string> {
  return dayKeyAt(now, await getDayStartHour())
}

// ---------------------------------------------------------------- clock

export interface DaySnapshot {
  today: string
  startHour: DayStartHour
  /** Milliseconds until the next day starts, as of the last check. */
  msLeft: number
}

export interface DayClockOptions {
  /** Called once per day change with the previous and the new day (also on wake after several days). */
  onNewDay?: (today: string, previous: string) => void
}

/**
 * Keeps "today" correct while the app is open. Every check reads the real
 * clock, so timers that were paused (sleep) or fire early never matter:
 * the next check corrects it. Checks run on start, on visibilitychange, focus
 * and pageshow, and at every minute boundary.
 */
/** Last day-start hour seen on this device, so the first check after opening is already right. */
const START_CACHE = 'fromzero-day-start'

function cachedStartHour(): DayStartHour {
  try {
    return normalizeDayStart(Number(localStorage.getItem(START_CACHE) ?? DEFAULT_DAY_START))
  } catch {
    return DEFAULT_DAY_START
  }
}

function cacheStartHour(hour: DayStartHour) {
  try {
    localStorage.setItem(START_CACHE, String(hour))
  } catch {
    // Storage blocked: the profile still has the setting.
  }
}

export function createDayClock(options: DayClockOptions & { startHour?: DayStartHour } = {}) {
  let startHour: DayStartHour = options.startHour ?? DEFAULT_DAY_START
  const snap = (): DaySnapshot => ({ today: dayKeyAt(Date.now(), startHour), startHour, msLeft: msUntilNextDay(Date.now(), startHour) })
  let snapshot = snap()
  const listeners = new Set<() => void>()
  const newDayListeners = new Set<(today: string, previous: string) => void>()
  if (options.onNewDay) newDayListeners.add(options.onNewDay)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let stopProfile: (() => void) | undefined

  function check(): DaySnapshot {
    const next = snap()
    const previous = snapshot
    const minuteChanged = Math.floor(next.msLeft / 60_000) !== Math.floor(previous.msLeft / 60_000)
    // Same day and same minute shown: keep the old object (React compares by identity).
    if (next.today === previous.today && next.startHour === previous.startHour && !minuteChanged) return previous
    snapshot = next
    for (const l of listeners) l()
    if (next.today !== previous.today) for (const l of newDayListeners) l(next.today, previous.today)
    return snapshot
  }

  /** While not started (tests, first render), refresh lazily without notifying anyone. */
  function read(): DaySnapshot {
    if (running) return snapshot
    const next = snap()
    const sameMinute = Math.floor(next.msLeft / 60_000) === Math.floor(snapshot.msLeft / 60_000)
    if (next.today !== snapshot.today || next.startHour !== snapshot.startHour || !sameMinute) snapshot = next
    return snapshot
  }

  /** Next check just after the next minute boundary (rescheduled after every check, early or late). */
  function schedule() {
    if (!running) return
    clearTimeout(timer)
    const ms = 60_000 - (Date.now() % 60_000) + 50
    timer = setTimeout(() => {
      check()
      schedule()
    }, ms)
  }

  const onWake = () => {
    check()
    schedule()
  }

  return {
    getSnapshot: read,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Run something whenever the day changes. Returns an unsubscribe function. */
    onNewDay(listener: (today: string, previous: string) => void) {
      newDayListeners.add(listener)
      return () => newDayListeners.delete(listener)
    },
    check,
    setStartHour(hour: number) {
      const h = normalizeDayStart(hour)
      if (running) cacheStartHour(h)
      if (h === startHour) return
      startHour = h
      check()
    },
    /** Start checking. `watchProfile` follows the profile's day-start setting in Dexie. */
    start({ watchProfile = true }: { watchProfile?: boolean } = {}) {
      if (running) return
      running = true
      check()
      schedule()
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake)
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', onWake)
        window.addEventListener('pageshow', onWake)
      }
      if (watchProfile) {
        const sub = liveQuery(() => db.profile.get('me')).subscribe({
          next: (p) => this.setStartHour(normalizeDayStart(p?.dayStartHour)),
          error: () => {},
        })
        stopProfile = () => sub.unsubscribe()
      }
    },
    stop() {
      running = false
      clearTimeout(timer)
      stopProfile?.()
      stopProfile = undefined
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake)
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWake)
        window.removeEventListener('pageshow', onWake)
      }
    },
  }
}

export type DayClock = ReturnType<typeof createDayClock>

/** The app's clock. `main.tsx` starts it; screens read it with the hooks below. */
export const dayClock = createDayClock({ startHour: cachedStartHour() })

/** Today, the day-start hour and time left, updating at every minute and day change. */
export function useDayClock(): DaySnapshot {
  return useSyncExternalStore(dayClock.subscribe, dayClock.getSnapshot)
}

/** Today's key (updates when the day changes). */
export function useToday(): string {
  return useDayClock().today
}
