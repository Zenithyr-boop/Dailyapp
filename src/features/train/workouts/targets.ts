/**
 * Per-movement targets in a workout: what a "set" means depends on how the
 * movement is logged. Rep-based movements get a rep range; timed movements get
 * seconds; distance movements get a time plus an optional distance.
 * Pure functions, unit-tested in `targets.test.ts`.
 */
import type { WorkoutItem } from '../../../lib/db'
import type { TrackingType } from '../library/types'

export const LIMITS = {
  sets: { min: 1, max: 10 },
  reps: { min: 1, max: 100 },
  seconds: { min: 5, max: 3600 },
  meters: { min: 0, max: 100_000 },
  rest: { min: 0, max: 600, step: 15 },
  rpe: { min: 5, max: 10, step: 0.5 },
  note: 200,
} as const

export const RPE_VALUES: readonly number[] = Array.from({ length: 11 }, (_, i) => 5 + i * 0.5)

export type TargetKind = 'reps' | 'time' | 'distance'

export function targetKind(tracking: TrackingType): TargetKind {
  if (tracking === 'time') return 'time'
  if (tracking === 'distance_time') return 'distance'
  return 'reps'
}

/** Best guess of an item's target kind from its own fields (movement unknown). */
export function kindFromItem(item: WorkoutItem): TargetKind {
  if (item.repsMin !== undefined) return 'reps'
  if (item.meters !== undefined) return 'distance'
  return 'time'
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const int = (n: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(n) ? clamp(Math.round(n as number), min, max) : fallback

export function newKey(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** Sensible defaults for a movement just added to a workout. */
export function newItem(movementId: string, tracking: TrackingType, key = newKey()): WorkoutItem {
  switch (targetKind(tracking)) {
    case 'time':
      return { key, movementId, sets: 3, seconds: 30, restSec: 60 }
    case 'distance':
      return { key, movementId, sets: 1, seconds: 600, restSec: 60 }
    default:
      return { key, movementId, sets: 3, repsMin: 8, repsMax: 12, restSec: 90 }
  }
}

/**
 * Clean an item for its tracking type: keep only the fields that fit, fill in
 * missing ones, clamp everything to the limits. Run before saving.
 */
export function fitTarget(item: WorkoutItem, tracking: TrackingType): WorkoutItem {
  const kind = targetKind(tracking)
  const defaults = newItem(item.movementId, tracking, item.key)
  const out: WorkoutItem = {
    key: item.key,
    movementId: item.movementId,
    sets: int(item.sets, defaults.sets, LIMITS.sets.min, LIMITS.sets.max),
    restSec: int(item.restSec, defaults.restSec, LIMITS.rest.min, LIMITS.rest.max),
  }
  if (kind === 'reps') {
    const min = int(item.repsMin, item.repsMax ?? defaults.repsMin!, LIMITS.reps.min, LIMITS.reps.max)
    const max = int(item.repsMax, min, LIMITS.reps.min, LIMITS.reps.max)
    out.repsMin = Math.min(min, max)
    out.repsMax = Math.max(min, max)
  } else {
    out.seconds = int(item.seconds, defaults.seconds!, LIMITS.seconds.min, LIMITS.seconds.max)
    if (kind === 'distance' && item.meters) {
      out.meters = int(item.meters, 0, LIMITS.meters.min, LIMITS.meters.max) || undefined
    }
  }
  if (item.rpe !== undefined && Number.isFinite(item.rpe)) {
    out.rpe = clamp(Math.round(item.rpe * 2) / 2, LIMITS.rpe.min, LIMITS.rpe.max)
  }
  const note = item.note?.trim().slice(0, LIMITS.note)
  if (note) out.note = note
  if (item.group) out.group = item.group
  return out
}

// ---- Formatting ------------------------------------------------------------------

/** 45 → "45 s", 90 → "1:30", 120 → "2:00". */
export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 2000 → "2 km", 400 → "400 m", 1500 → "1.5 km". */
export function formatMeters(m: number): string {
  return m >= 1000 ? `${+(m / 1000).toFixed(2)} km` : `${m} m`
}

/** "3 × 6–8", "3 × 8", "3 × 45 s", "1 × 10:00 · 2 km". */
export function formatTarget(item: WorkoutItem): string {
  const kind = kindFromItem(item)
  if (kind === 'reps') {
    const reps = item.repsMin === item.repsMax ? `${item.repsMin}` : `${item.repsMin}–${item.repsMax}`
    return `${item.sets} × ${reps}`
  }
  const time = `${item.sets} × ${formatSeconds(item.seconds ?? 0)}`
  return item.meters ? `${time} · ${formatMeters(item.meters)}` : time
}

export function formatRpe(rpe: number): string {
  return `RPE ${rpe % 1 ? rpe.toFixed(1) : rpe}`
}
