/**
 * Daily stats entered by hand: steps, sleep, water. They live on the day record
 * (`users/{uid}/days`) next to the quests, so automatic quests can tick from
 * them on the website too. The Android app will later fill the same fields from
 * Health Connect. Each value carries its own change time (`statsAt`) so sync
 * merges them one by one and a cleared value stays cleared.
 */
import { db, type Day, type DayStat } from '../../lib/db'
import { getToday } from '../../lib/day'
import { FutureDayError } from '../body/bodyRepo'
import { dayForWrite, ensureDay, ensureSetup } from '../quests/questsRepo'

/** The quick-entry dialogs (`?stat=`). */
export type StatKind = 'steps' | 'sleep' | 'water'

export function isStatKind(v: unknown): v is StatKind {
  return v === 'steps' || v === 'sleep' || v === 'water'
}

/** Values to set (a number) or clear (undefined). */
export type StatChanges = Partial<Record<DayStat, number | undefined>>

/** Limits for typed values. */
export const STAT_LIMITS = {
  steps: { min: 0, max: 200_000 },
  sleepMinutes: { min: 0, max: 24 * 60 },
  waterMl: { min: 0, max: 20_000 },
} as const

function clean(field: DayStat, v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined
  const { min, max } = STAT_LIMITS[field]
  return Math.round(Math.min(max, Math.max(min, v)))
}

export function saveStats(date: string, changes: StatChanges): Promise<void> {
  return updateStats(date, () => changes)
}

/**
 * Change stats from the day's current values, read inside the same
 * transaction (so two quick taps on "+250 ml" both count).
 */
async function updateStats(date: string, changesFor: (day: Day) => StatChanges): Promise<void> {
  const today = await getToday()
  if (date > today) throw new FutureDayError(date)
  await ensureSetup()
  if (date === today) await ensureDay(today)
  await db.transaction('rw', db.days, db.quests, async () => {
    const day = await dayForWrite(date)
    const changes = changesFor(day)
    const now = Date.now()
    const next = { ...day, statsAt: { ...day.statsAt } }
    let changed = false
    for (const [field, raw] of Object.entries(changes) as [DayStat, number | undefined][]) {
      const value = clean(field, raw)
      if (day[field] === value) continue
      changed = true
      next.statsAt[field] = now
      if (value === undefined) delete next[field]
      else next[field] = value
    }
    if (!changed) return
    delete next.deleted
    await db.days.put({ ...next, updatedAt: now })
  })
}

/** Add (or with a negative amount, remove) water, never below 0. */
export function addWater(date: string, ml: number): Promise<void> {
  return updateStats(date, (day) => ({ waterMl: Math.max(0, (day.waterMl ?? 0) + ml) }))
}
