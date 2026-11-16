/**
 * Turns Health Connect data into FromZero day values. Pure (unit-tested): the
 * plugin calls live in `bridge.ts`, the writes in `features/today/healthSync.ts`.
 *
 * Days follow the user's day start (`lib/day.ts`), not midnight: with a 4 AM start,
 * steps walked at 01:00 count toward the day before, like everything else.
 */
import { dayKeyAt } from '../day'

/** What Health Connect gives FromZero for one day. */
export interface HealthDayValues {
  steps?: number
  sleepMinutes?: number
  weightKg?: number
}

export type HealthField = keyof HealthDayValues

/** Day key → values. */
export type HealthByDay = Record<string, HealthDayValues>

/** One aggregated bucket (hourly step totals; Health Connect removes phone + watch duplicates). */
export interface StepBucket {
  startDate: string
  value: number
}

/** A sleep session, with its stages when the tracker recorded them. */
export interface SleepSession {
  startDate: string
  endDate: string
  stages?: { startDate: string; endDate: string; stage: string }[]
}

/** A weigh-in. */
export interface WeightSample {
  startDate: string
  value: number
}

/** Stages that count as asleep (awake / in bed / out of bed don't). */
const ASLEEP_STAGES = new Set(['asleep', 'light', 'deep', 'rem'])

/** Sum hourly step buckets into days. Bucket boundaries line up with day starts (whole hours). */
export function stepsByDay(buckets: StepBucket[], startHour: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of buckets) {
    if (!Number.isFinite(b.value) || b.value <= 0) continue
    const key = dayKeyAt(Date.parse(b.startDate), startHour)
    out[key] = (out[key] ?? 0) + b.value
  }
  return Object.fromEntries(Object.entries(out).map(([key, steps]) => [key, Math.round(steps)]))
}

type Interval = [number, number]

/** Total length of a set of intervals, counting overlaps once. */
function unionMs(intervals: Interval[]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  let total = 0
  let cur: Interval | undefined
  for (const iv of sorted) {
    if (cur && iv[0] <= cur[1]) cur[1] = Math.max(cur[1], iv[1])
    else {
      if (cur) total += cur[1] - cur[0]
      cur = [iv[0], iv[1]]
    }
  }
  if (cur) total += cur[1] - cur[0]
  return total
}

/**
 * Minutes asleep per day. A night counts toward the day you wake up on (its end time),
 * naps add to it. With stages, only asleep stages count; without, the whole session.
 * Overlapping sessions (a watch and a phone app both tracking) count once.
 */
export function sleepByDay(sessions: SleepSession[], startHour: number): Record<string, number> {
  const byDay: Record<string, Interval[]> = {}
  for (const s of sessions) {
    const end = Date.parse(s.endDate)
    const start = Date.parse(s.startDate)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const key = dayKeyAt(end, startHour)
    const asleep = (s.stages ?? []).filter((st) => ASLEEP_STAGES.has(st.stage))
    const intervals: Interval[] = s.stages?.length
      ? asleep.map((st) => [Date.parse(st.startDate), Date.parse(st.endDate)])
      : [[start, end]]
    ;(byDay[key] ??= []).push(...intervals)
  }
  const out: Record<string, number> = {}
  for (const [key, intervals] of Object.entries(byDay)) {
    const minutes = Math.round(unionMs(intervals) / 60_000)
    if (minutes > 0) out[key] = minutes
  }
  return out
}

/** The last weigh-in of each day. */
export function weightByDay(samples: WeightSample[], startHour: number): Record<string, number> {
  const latest: Record<string, { at: number; kg: number }> = {}
  for (const s of samples) {
    const at = Date.parse(s.startDate)
    if (!Number.isFinite(at) || !Number.isFinite(s.value) || s.value <= 0) continue
    const key = dayKeyAt(at, startHour)
    if (!latest[key] || at >= latest[key].at) latest[key] = { at, kg: s.value }
  }
  return Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, Math.round(v.kg * 1000) / 1000]))
}

/** Put the per-field maps together into one map of days. */
export function combineDays(parts: Partial<Record<HealthField, Record<string, number>>>): HealthByDay {
  const out: HealthByDay = {}
  for (const [field, days] of Object.entries(parts) as [HealthField, Record<string, number>][]) {
    for (const [key, value] of Object.entries(days)) (out[key] ??= {})[field] = value
  }
  return out
}

/** The values to write for one day. */
export interface HealthWrite {
  date: string
  values: HealthDayValues
}

/**
 * What to write: every value that differs from what was imported last time for
 * that day. A value Health Connect still reports unchanged is skipped, so a number
 * the user corrected by hand stays until Health Connect has a new one. Days with
 * no data are left alone (nothing is ever cleared).
 */
export function planHealthWrites(read: HealthByDay, imported: HealthByDay, today: string): HealthWrite[] {
  const writes: HealthWrite[] = []
  for (const [date, day] of Object.entries(read).sort(([a], [b]) => a.localeCompare(b))) {
    if (date > today) continue
    const values: HealthDayValues = {}
    for (const [field, value] of Object.entries(day) as [HealthField, number | undefined][]) {
      if (value === undefined || imported[date]?.[field] === value) continue
      values[field] = value
    }
    if (Object.keys(values).length) writes.push({ date, values })
  }
  return writes
}

/** Remember what was written, dropping days before `oldest`. */
export function rememberImported(imported: HealthByDay, writes: HealthWrite[], oldest: string): HealthByDay {
  const next: HealthByDay = {}
  for (const [date, values] of Object.entries(imported)) if (date >= oldest) next[date] = { ...values }
  for (const { date, values } of writes) if (date >= oldest) next[date] = { ...next[date], ...values }
  return next
}
