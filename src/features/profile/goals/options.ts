/** Choices offered in onboarding and Me → Goals. */
import type { HeightUnits, UnitSystem } from '../../../lib/units'
import { ACTIVITY_LEVELS, type ActivityLevel, type GoalKind, type Sex } from './coachTargets'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
}

export const SEX_OPTIONS: readonly ChoiceOption<Sex>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say', description: 'We’ll use an average of the two formulas' },
]

export const ACTIVITY_OPTIONS: readonly ChoiceOption<ActivityLevel>[] = ACTIVITY_LEVELS.map(
  (a) => ({ value: a.id, label: a.label, description: a.description }),
)

export const GOAL_OPTIONS: readonly ChoiceOption<GoalKind>[] = [
  { value: 'lose', label: 'Lose fat', description: 'Eat a little under maintenance' },
  { value: 'maintain', label: 'Maintain', description: 'Hold your weight, build habits and strength' },
  { value: 'gain', label: 'Build muscle', description: 'Eat a little over maintenance' },
]

export const WEIGHT_UNIT_OPTIONS: readonly ChoiceOption<UnitSystem>[] = [
  { value: 'metric', label: 'kg' },
  { value: 'imperial', label: 'lb' },
]

export const HEIGHT_UNIT_OPTIONS: readonly ChoiceOption<HeightUnits>[] = [
  { value: 'cm', label: 'cm' },
  { value: 'ftin', label: 'ft / in' },
]
