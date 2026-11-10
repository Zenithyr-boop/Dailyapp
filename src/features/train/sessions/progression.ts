/**
 * Progression rules and plate increments. EDIT FREELY: every number and list
 * here can be tuned. Tests in `sessions.test.ts` check the rules, so update
 * them if you change the behaviour on purpose.
 *
 * Rule (per weighted movement, after a session):
 * - every planned set was done, reached the TOP of the rep range, and was at or
 *   below the target RPE (sets without a logged RPE only need the reps)
 *   → suggest adding weight next time;
 * - otherwise → keep the weight.
 */
import type { SessionExercise } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import type { TrackingType } from '../library/types'

/** Weight to add when the rule says "go up", in kg. */
export const INCREASE_KG = {
  lowerBody: 2.5,
  upperBody: 1.25,
}

/** A movement counts as lower body when its main (primary) muscle is one of these. */
export const LOWER_BODY_MUSCLES: readonly string[] = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'lower back',
]

/**
 * Smallest real weight jump, per unit system. Converted, prefilled and
 * suggested weights are rounded to this; what the user types is kept as is.
 * 1.25 kg keeps the +1.25 kg upper-body jump (fractional plates or 0.625 kg
 * per side); 2.5 lb = a pair of 1.25 lb plates.
 */
export const PLATE_STEP: Record<UnitSystem, number> = {
  metric: 1.25,
  imperial: 2.5,
}

// ---- The rule ------------------------------------------------------------------

export type ProgressionHint =
  | { action: 'increase'; fromKg: number; toKg: number; byKg: number }
  | { action: 'keep'; kg: number; reason: string }

export interface HintMovement {
  tracking: TrackingType
  primaryMuscles: readonly string[]
}

export function isLowerBody(movement: Pick<HintMovement, 'primaryMuscles'>): boolean {
  return LOWER_BODY_MUSCLES.includes(movement.primaryMuscles[0] ?? '')
}

/**
 * Next-time hint for one movement of a session, or undefined when the rule
 * doesn't apply (not a weighted movement, no rep range, nothing lifted).
 */
export function progressionHint(exercise: SessionExercise, movement: HintMovement): ProgressionHint | undefined {
  const target = exercise.target
  if (movement.tracking !== 'weight_reps' || !target?.repsMax) return undefined
  const done = exercise.sets.filter((s) => s.done && (s.kg ?? 0) > 0)
  if (!done.length) return undefined
  const kg = Math.max(...done.map((s) => s.kg ?? 0))

  if (done.length < target.sets) return { action: 'keep', kg, reason: `${done.length} of ${target.sets} sets done` }
  const short = done.find((s) => (s.reps ?? 0) < target.repsMax!)
  if (short) return { action: 'keep', kg, reason: `not every set reached ${target.repsMax} reps` }
  if (target.rpe !== undefined && done.some((s) => s.rpe !== undefined && s.rpe > target.rpe!)) {
    return { action: 'keep', kg, reason: `RPE went above ${target.rpe}` }
  }
  const byKg = isLowerBody(movement) ? INCREASE_KG.lowerBody : INCREASE_KG.upperBody
  return { action: 'increase', fromKg: kg, toKg: kg + byKg, byKg }
}
