/**
 * Calorie and macro targets from body stats and a goal. Pure functions, no
 * database; every number comes from `coachTargets.ts`. Tests: `targets.test.ts`.
 *
 * 1. BMR (Mifflin-St Jeor) × activity multiplier = maintenance.
 * 2. Goal: ± rate × 7,700 kcal / 7 days. Loss is capped at 1% of body weight a week.
 * 3. Never below the calorie floor.
 * 4. Protein g/kg, fat a share of calories with a g/kg minimum, carbs the rest.
 */
import { kgToLb, lbToKg, type UnitSystem } from '../../../lib/units'
import {
  ACTIVITY_LEVELS,
  CALORIE_FLOOR,
  FAT_MIN_G_PER_KG,
  FAT_SHARE_OF_KCAL,
  KCAL_PER_KG,
  KCAL_ROUND_TO,
  MAX_LOSS_PCT_PER_WEEK,
  MIFFLIN_SEX_CONSTANT,
  PROTEIN_G_PER_KG,
  RATE_OPTIONS,
  REFERENCE_BMI_CAP,
  type ActivityLevel,
  type GoalKind,
  type Sex,
} from './coachTargets'

export type { ActivityLevel, GoalKind, Sex } from './coachTargets'

/** What the user told us about themselves. Any of it may be missing. */
export interface BodyStats {
  sex?: Sex
  birthYear?: number
  heightCm?: number
  weightKg?: number
  activity?: ActivityLevel
}

export interface GoalPlan {
  goal: GoalKind
  /** Requested rate, kg per week (positive for both losing and gaining; 0 for maintain). */
  rateKgPerWeek: number
}

export interface MacroTargets {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export interface TargetResult extends MacroTargets {
  bmr: number
  maintenance: number
  /** The rate actually used (after the 1% cap), kg per week. */
  rateKgPerWeek: number
  /** The requested loss was above 1% of body weight and was lowered. */
  capped: boolean
  /** Calories were raised to the floor. */
  floored: boolean
  floor: number
  /** Expected change in kg per week at these calories (negative = losing). */
  expectedKgPerWeek: number
}

const round = (n: number, step = 1) => Math.round(n / step) * step

export function ageFrom(birthYear: number, year: number = new Date().getFullYear()): number {
  return year - birthYear
}

export function bmr(stats: { sex: Sex; age: number; heightCm: number; weightKg: number }): number {
  return 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age + MIFFLIN_SEX_CONSTANT[stats.sex]
}

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.id === level)?.multiplier ?? 1.2
}

/** Highest loss allowed for this body weight, kg per week. */
export function maxLossKgPerWeek(weightKg: number): number {
  return (weightKg * MAX_LOSS_PCT_PER_WEEK) / 100
}

/** Weight used for protein and the fat minimum: actual weight, but no more than the weight at the BMI cap. */
export function referenceWeightKg(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.min(weightKg, REFERENCE_BMI_CAP * m * m)
}

/** True when there is enough to calculate targets. */
export function canCalculate(body: BodyStats | undefined): body is BodyStats & Required<Pick<BodyStats, 'birthYear' | 'heightCm' | 'weightKg' | 'activity'>> {
  return !!body && body.birthYear !== undefined && body.heightCm !== undefined && body.weightKg !== undefined && body.activity !== undefined
}

/** Split calories into protein, fat and carbs (grams). */
export function splitMacros(kcal: number, refWeightKg: number, goal: GoalKind): Omit<MacroTargets, 'kcal'> {
  const proteinG = round(refWeightKg * PROTEIN_G_PER_KG[goal])
  const fatMin = refWeightKg * FAT_MIN_G_PER_KG
  let fatG = Math.max((kcal * FAT_SHARE_OF_KCAL) / 9, fatMin)
  // Tight budget: fat gives way to its minimum before carbs go below zero.
  if (kcal - proteinG * 4 - fatG * 9 < 0) fatG = fatMin
  fatG = round(fatG)
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4))
  return { proteinG, fatG, carbsG }
}

/** Targets for this body and goal, or undefined when height, weight, birth year or activity is missing. */
export function calculateTargets(
  body: BodyStats | undefined,
  plan: GoalPlan,
  year: number = new Date().getFullYear(),
): TargetResult | undefined {
  if (!canCalculate(body)) return undefined
  const sex = body.sex ?? 'unspecified'
  const base = bmr({ sex, age: ageFrom(body.birthYear, year), heightCm: body.heightCm, weightKg: body.weightKg })
  const maintenance = base * activityMultiplier(body.activity)

  const requested = plan.goal === 'maintain' ? 0 : Math.max(0, plan.rateKgPerWeek)
  const maxLoss = maxLossKgPerWeek(body.weightKg)
  const capped = plan.goal === 'lose' && requested > maxLoss + 1e-9
  const rate = capped ? maxLoss : requested
  const daily = (rate * KCAL_PER_KG) / 7
  const raw = plan.goal === 'lose' ? maintenance - daily : plan.goal === 'gain' ? maintenance + daily : maintenance

  const floor = CALORIE_FLOOR[sex]
  const floored = raw < floor
  const kcal = round(Math.max(raw, floor), KCAL_ROUND_TO)

  return {
    kcal,
    ...splitMacros(kcal, referenceWeightKg(body.weightKg, body.heightCm), plan.goal),
    bmr: Math.round(base),
    maintenance: round(maintenance, KCAL_ROUND_TO),
    rateKgPerWeek: rate,
    capped,
    floored,
    floor,
    expectedKgPerWeek: ((kcal - maintenance) * 7) / KCAL_PER_KG,
  }
}

/** Calories that a set of macros adds up to (4 / 4 / 9). */
export function kcalFromMacros(m: Pick<MacroTargets, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9
}

// ---- Rate options in the user's units ------------------------------------------

export interface RateOption {
  /** Stored value, kg per week. */
  kg: number
  /** Shown value in the user's unit. */
  shown: number
  unit: 'kg' | 'lb'
}

export function rateOptions(goal: 'lose' | 'gain', units: UnitSystem): RateOption[] {
  const metric = units === 'metric'
  const list = metric ? RATE_OPTIONS[goal].kg : RATE_OPTIONS[goal].lb
  return list.map((shown) => ({ kg: metric ? shown : lbToKg(shown), shown, unit: metric ? 'kg' : 'lb' }))
}

/** The option matching a stored rate (rates picked in the other unit match the nearest). */
export function nearestRateOption(goal: 'lose' | 'gain', units: UnitSystem, rateKg: number): RateOption {
  const options = rateOptions(goal, units)
  return options.reduce((best, o) => (Math.abs(o.kg - rateKg) < Math.abs(best.kg - rateKg) ? o : best), options[0]!)
}

/** The rate is the fastest option offered (for the gentle note). */
export function isFastestRate(goal: GoalKind, units: UnitSystem, rateKg: number): boolean {
  if (goal === 'maintain') return false
  const fastest = rateOptions(goal, units).at(-1)!
  return nearestRateOption(goal, units, rateKg).shown === fastest.shown
}

/**
 * "0.5 kg" / "1.5 lb" for a weekly rate or change. `approx` rounds to one
 * decimal, for estimates ("about 2 lb a week", not "1.99 lb").
 */
export function formatRate(kg: number, units: UnitSystem, { approx = false } = {}): string {
  const value = units === 'metric' ? kg : kgToLb(kg)
  const factor = approx ? 10 : 100
  const text = Math.abs(value) >= 10 ? value.toFixed(0) : String(Math.round(value * factor) / factor)
  return `${text} ${units === 'metric' ? 'kg' : 'lb'}`
}
