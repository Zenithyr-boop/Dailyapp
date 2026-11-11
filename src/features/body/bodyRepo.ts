/**
 * Weigh-ins and measurements. They live on the day records (`users/{uid}/days`),
 * so they sync with the rest of the day. Each value carries its own change time
 * (`bodyAt`) so sync merges them one by one (`mergeDay` in `lib/sync/merge.ts`).
 * Any day up to today can be logged; never a future day.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BodyField, type Day, type MeasureKey } from '../../lib/db'
import { getToday } from '../../lib/day'
import { dayForWrite, ensureDay, ensureSetup } from '../quests/questsRepo'

export class FutureDayError extends Error {
  constructor(date: string) {
    super(`${date} is in the future`)
  }
}

/** Values to set (a number) or clear (undefined). Fields not listed stay as they are. */
export type BodyChanges = Partial<Record<BodyField, number | undefined>>

/** Stored precision: kg to 3 decimals (lb round-trips to 0.1), cm to 2 (inches round-trip). */
function roundFor(field: BodyField, value: number): number {
  const f = field === 'weightKg' ? 1000 : 100
  return Math.round(value * f) / f
}

function valueOf(day: Day, field: BodyField): number | undefined {
  return field === 'weightKg' ? day.weightKg : day.measurements?.[field]
}

/**
 * Set or clear body values for a day. A day with no record yet gets one: with
 * unchecked quests inside the user's quest history (like any missed day), or
 * with no quests before their first quest day (so it never counts as a miss).
 */
export async function saveBody(date: string, changes: BodyChanges): Promise<void> {
  const today = await getToday()
  if (date > today) throw new FutureDayError(date)
  await ensureSetup()
  if (date === today) await ensureDay(today)

  let weightChanged = false
  await db.transaction('rw', db.days, db.quests, async () => {
    const now = Date.now()
    const day = await dayForWrite(date)

    let weightKg = day.weightKg
    const measurements = { ...day.measurements }
    const bodyAt = { ...day.bodyAt }
    let changed = false
    for (const [field, raw] of Object.entries(changes) as [BodyField, number | undefined][]) {
      const value = raw === undefined || !Number.isFinite(raw) ? undefined : roundFor(field, raw)
      if (valueOf(day, field) === value) continue
      changed = true
      bodyAt[field] = now
      if (field === 'weightKg') {
        weightKg = value
        weightChanged = true
      } else if (value === undefined) delete measurements[field]
      else measurements[field] = value
    }
    if (!changed) return

    const next: Day = { ...day, bodyAt, updatedAt: now }
    delete next.deleted
    delete next.weightKg
    delete next.measurements
    if (weightKg !== undefined) next.weightKg = weightKg
    if (Object.keys(measurements).length) next.measurements = measurements
    await db.days.put(next)
  })
  if (weightChanged) await syncProfileWeight()
}

export function saveWeight(date: string, kg: number | undefined): Promise<void> {
  return saveBody(date, { weightKg: kg })
}

/**
 * The profile's body weight (used for calorie targets) follows the latest
 * weigh-in. Targets themselves only change when the user saves Me → Goals.
 */
async function syncProfileWeight(): Promise<void> {
  const latest = await db.days
    .orderBy('date')
    .reverse()
    .filter((d) => !d.deleted && d.weightKg !== undefined)
    .first()
  if (latest?.weightKg === undefined) return
  const profile = await db.profile.get('me')
  if (!profile || profile.body?.weightKg === latest.weightKg) return
  await db.profile.update('me', { body: { ...profile.body, weightKg: latest.weightKg } })
}

export async function setGoalWeight(kg: number | undefined): Promise<void> {
  await ensureSetup()
  await db.profile.update('me', { goalWeightKg: kg === undefined ? undefined : roundFor('weightKg', kg) })
}

/** A weigh-in or measurement on a day. */
export interface BodyPoint {
  date: string
  value: number
}

/** Every day holding body data, oldest first. Undefined while loading. */
export function useBodyDays(): Day[] | undefined {
  return useLiveQuery(
    () =>
      db.days
        .orderBy('date')
        .filter((d) => !d.deleted && (d.weightKg !== undefined || d.measurements !== undefined))
        .toArray(),
    [],
  )
}

export function weightPoints(days: readonly Day[]): BodyPoint[] {
  return days.flatMap((d) => (d.weightKg === undefined ? [] : [{ date: d.date, value: d.weightKg }]))
}

export function measurePoints(days: readonly Day[], key: MeasureKey): BodyPoint[] {
  return days.flatMap((d) => {
    const value = d.measurements?.[key]
    return value === undefined ? [] : [{ date: d.date, value }]
  })
}
