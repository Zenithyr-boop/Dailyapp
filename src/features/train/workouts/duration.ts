/**
 * Estimated workout duration from sets, targets and rest times.
 *
 * - A rep-based set takes ~4 s per rep (middle of the range) plus 10 s to set up.
 * - A timed or distance set takes its target time plus 10 s to set up.
 * - Each movement (a superset counts once) adds 2 min for warm-up sets and
 *   moving between stations.
 * - Rest follows every set except the very last one of the workout.
 *   Inside a superset only the last movement rests (see `effectiveRest`), so a
 *   round's rest is counted once.
 */
import type { WorkoutItem } from '../../../lib/db'
import { effectiveRest, linkedToNext } from './supersets'
import { kindFromItem } from './targets'

export const SECONDS_PER_REP = 4
export const SETUP_SECONDS = 10
export const CHANGEOVER_SECONDS = 120

/** Time under work for one set of this item, in seconds. */
export function workSeconds(item: WorkoutItem): number {
  if (kindFromItem(item) === 'reps') {
    const reps = ((item.repsMin ?? 0) + (item.repsMax ?? item.repsMin ?? 0)) / 2
    return Math.round(reps) * SECONDS_PER_REP + SETUP_SECONDS
  }
  return (item.seconds ?? 0) + SETUP_SECONDS
}

export function estimateSeconds(items: readonly WorkoutItem[]): number {
  if (!items.length) return 0
  const total = items.reduce(
    (sum, item, i) =>
      sum +
      item.sets * (workSeconds(item) + effectiveRest(items, i)) +
      (linkedToNext(items, i - 1) ? 0 : CHANGEOVER_SECONDS),
    0,
  )
  return Math.max(0, total - effectiveRest(items, items.length - 1))
}

/** 0 → "0 min", 52·60 → "52 min", 75·60 → "1 h 15 min". Rounded to the minute. */
export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
