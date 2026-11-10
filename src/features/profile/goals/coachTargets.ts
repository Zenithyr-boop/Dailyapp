/**
 * Every number behind calorie and macro targets, in one place for the coach to
 * tune. The maths that uses them is in `targets.ts` (unit-tested).
 *
 * Changing a number here changes targets for anyone who next saves their goals
 * (onboarding or Me → Goals). Saved targets never shift on their own.
 */

export type Sex = 'male' | 'female' | 'unspecified'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type GoalKind = 'lose' | 'maintain' | 'gain'

/**
 * Mifflin-St Jeor: BMR = 10 × kg + 6.25 × cm − 5 × age + this constant.
 * "Prefer not to say" uses the midpoint of the two published constants.
 */
export const MIFFLIN_SEX_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  unspecified: -78,
}

/** BMR × multiplier = maintenance calories. */
export const ACTIVITY_LEVELS: readonly { id: ActivityLevel; label: string; description: string; multiplier: number }[] = [
  { id: 'sedentary', label: 'Mostly sitting', description: 'Desk job, little walking, no training', multiplier: 1.2 },
  { id: 'light', label: 'Lightly active', description: 'On your feet some of the day, or training 1–3× a week', multiplier: 1.375 },
  { id: 'moderate', label: 'Active', description: 'Training 3–5× a week, or an active job', multiplier: 1.55 },
  { id: 'very', label: 'Very active', description: 'Hard training 6–7× a week, or a physical job', multiplier: 1.725 },
  { id: 'extra', label: 'Athlete', description: 'Training twice a day, or a very physical job plus training', multiplier: 1.9 },
]

/** Energy in 1 kg of body weight change. */
export const KCAL_PER_KG = 7700

/** Weight loss is capped at this % of body weight per week, whatever rate was picked. */
export const MAX_LOSS_PCT_PER_WEEK = 1

/**
 * Weekly rate options shown to the user, in their own unit.
 * The last option of each list is the "most aggressive" one and shows a gentle note.
 */
export const RATE_OPTIONS: Record<'lose' | 'gain', { kg: readonly number[]; lb: readonly number[] }> = {
  lose: { kg: [0.25, 0.5, 0.75, 1], lb: [0.5, 1, 1.5, 2] },
  gain: { kg: [0.1, 0.25, 0.5], lb: [0.25, 0.5, 1] },
}

/** Pre-selected rate (kg per week) when a goal is picked. */
export const DEFAULT_RATE_KG: Record<GoalKind, number> = { lose: 0.5, maintain: 0, gain: 0.25 }

/** Calculated calories never go below this, whatever the goal. */
export const CALORIE_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1350,
}

/** Protein in grams per kg of body weight, by goal. */
export const PROTEIN_G_PER_KG: Record<GoalKind, number> = {
  lose: 2.0,
  maintain: 1.6,
  gain: 1.8,
}

/**
 * For heavier people, protein and the fat minimum use the weight at this BMI
 * instead of actual weight (otherwise 2 g/kg at 150 kg asks for 300 g).
 */
export const REFERENCE_BMI_CAP = 30

/** Fat as a share of calories… */
export const FAT_SHARE_OF_KCAL = 0.25
/** …but never below this many grams per kg. Carbs make up the rest. */
export const FAT_MIN_G_PER_KG = 0.8

/** Calories are rounded to this step. */
export const KCAL_ROUND_TO = 10

/** Age range the formula is offered for. */
export const MIN_AGE = 13
export const MAX_AGE = 100
