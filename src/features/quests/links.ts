/**
 * Automatic ("linked") quests: checkbox quests that tick themselves from real
 * data (steps, sleep, food, weigh-in, water, workouts). Pure rules, unit-tested
 * in `links.test.ts`; the engine that applies them is `autoQuests.ts`.
 *
 * Defaults and limits below are the coach's to tune.
 */
import type { LinkSource, QuestLink } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'

export const ML_PER_OZ = 29.5735

interface SourceInfo {
  id: LinkSource
  label: string
  /** What the quest's number means (none = no number). */
  target?: { min: number; max: number; default: number; label: string }
  /** Shown in the quest form. */
  help: string
}

export const LINK_SOURCES: readonly SourceInfo[] = [
  { id: 'steps', label: 'Steps', target: { min: 500, max: 100_000, default: 8000, label: 'Steps' }, help: 'Ticks when steps reach the target.' },
  { id: 'sleep', label: 'Sleep', target: { min: 180, max: 720, default: 420, label: 'Hours' }, help: 'Ticks when last night’s sleep reaches the hours.' },
  { id: 'protein', label: 'Protein', help: 'Ticks when the day’s food reaches your protein goal (Me → Goals).' },
  {
    id: 'calories',
    label: 'Calories',
    target: { min: 25, max: 1000, default: 150, label: '± kcal' },
    help: 'Ticks when the day’s calories are within this range of your calorie goal.',
  },
  { id: 'weighIn', label: 'Weigh-in', help: 'Ticks when you log a weigh-in that day (Body).' },
  { id: 'water', label: 'Water', target: { min: 250, max: 10_000, default: 2500, label: 'Water' }, help: 'Ticks when the day’s water reaches the amount.' },
  { id: 'workout', label: 'Workout', help: 'Ticks when you finish a workout that day (Train).' },
]

export const sourceInfo = (id: LinkSource): SourceInfo => LINK_SOURCES.find((s) => s.id === id)!

export function isLinkSource(v: unknown): v is LinkSource {
  return LINK_SOURCES.some((s) => s.id === v)
}

/** Keep the number inside its limits (default when missing); drop it for sources without one. */
export function normalizeLink(link: QuestLink): QuestLink {
  const info = sourceInfo(link.source)
  if (!info.target) return { source: link.source }
  const t = link.target
  const target = t === undefined || !Number.isFinite(t) ? info.target.default : Math.min(info.target.max, Math.max(info.target.min, Math.round(t)))
  return { source: link.source, target }
}

const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const dec1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** "7 h", "7 h 30 m". */
export function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h} h ${m} m` : `${h} h`
}

/** "2.5 L" / "85 oz". */
export function formatWater(ml: number, units: UnitSystem): string {
  return units === 'metric' ? `${dec1.format(ml / 1000)} L` : `${num.format(ml / ML_PER_OZ)} oz`
}

/** A title for a new automatic quest ("Walk 8,000 steps"). */
export function defaultTitle(link: QuestLink, units: UnitSystem): string {
  const l = normalizeLink(link)
  switch (l.source) {
    case 'steps':
      return `Walk ${num.format(l.target!)} steps`
    case 'sleep':
      return `Sleep ${formatSleep(l.target!)}`
    case 'protein':
      return 'Hit protein goal'
    case 'calories':
      return 'Hit calorie target'
    case 'weighIn':
      return 'Weigh in'
    case 'water':
      return `Drink ${formatWater(l.target!, units)} water`
    case 'workout':
      return 'Train'
  }
}

/** Everything a day's automatic quests look at. */
export interface LinkData {
  steps?: number
  sleepMinutes?: number
  waterMl?: number
  weightKg?: number
  /** Food logged that day. */
  kcal: number
  proteinG: number
  foodEntries: number
  /** Finished workouts that day. */
  workouts: number
  goals: { kcal?: number; proteinG?: number }
}

export interface LinkResult {
  done: boolean
  /** The quest follows a goal that isn't set. */
  missingGoal?: 'protein' | 'calories'
}

export function evaluateLink(link: QuestLink, d: LinkData): LinkResult {
  const l = normalizeLink(link)
  switch (l.source) {
    case 'steps':
      return { done: (d.steps ?? 0) >= l.target! }
    case 'sleep':
      return { done: (d.sleepMinutes ?? 0) >= l.target! }
    case 'water':
      return { done: (d.waterMl ?? 0) >= l.target! }
    case 'weighIn':
      return { done: d.weightKg !== undefined }
    case 'workout':
      return { done: d.workouts > 0 }
    case 'protein':
      if (!d.goals.proteinG) return { done: false, missingGoal: 'protein' }
      return { done: d.proteinG >= d.goals.proteinG }
    case 'calories':
      if (!d.goals.kcal) return { done: false, missingGoal: 'calories' }
      return { done: d.foodEntries > 0 && Math.abs(d.kcal - d.goals.kcal) <= l.target! }
  }
}

/** One line of live progress for the quest row ("6,240 / 8,000 steps"). */
export function describeLink(link: QuestLink, d: LinkData, units: UnitSystem): string {
  const l = normalizeLink(link)
  switch (l.source) {
    case 'steps':
      return `${num.format(d.steps ?? 0)} / ${num.format(l.target!)} steps`
    case 'sleep':
      return d.sleepMinutes === undefined ? `No sleep logged · target ${formatSleep(l.target!)}` : `${formatSleep(d.sleepMinutes)} / ${formatSleep(l.target!)} sleep`
    case 'water':
      return `${formatWater(d.waterMl ?? 0, units)} / ${formatWater(l.target!, units)}`
    case 'weighIn':
      return d.weightKg === undefined ? 'No weigh-in yet' : 'Weighed in'
    case 'workout':
      return d.workouts === 0 ? 'No workout finished yet' : d.workouts === 1 ? 'Workout finished' : `${d.workouts} workouts finished`
    case 'protein':
      return d.goals.proteinG ? `${num.format(d.proteinG)} / ${num.format(d.goals.proteinG)} g protein` : 'Set your protein goal in Me → Goals'
    case 'calories':
      return d.goals.kcal
        ? `${num.format(d.kcal)} kcal · target ${num.format(d.goals.kcal)} ± ${num.format(l.target!)}`
        : 'Set your calorie goal in Me → Goals'
  }
}

/** "Steps ≥ 8,000" — what a quest follows, for Edit quests. */
export function linkSummary(link: QuestLink, units: UnitSystem): string {
  const l = normalizeLink(link)
  switch (l.source) {
    case 'steps':
      return `Steps ≥ ${num.format(l.target!)}`
    case 'sleep':
      return `Sleep ≥ ${formatSleep(l.target!)}`
    case 'water':
      return `Water ≥ ${formatWater(l.target!, units)}`
    case 'protein':
      return 'Protein ≥ your goal'
    case 'calories':
      return `Calories within ± ${num.format(l.target!)} kcal of your goal`
    case 'weighIn':
      return 'Weighed in that day'
    case 'workout':
      return 'Finished a workout that day'
  }
}

/** The quest's number as typed in the form, in the user's units (sleep in hours, water in L or oz). */
export function targetForInput(link: QuestLink, units: UnitSystem): string {
  const l = normalizeLink(link)
  if (l.target === undefined) return ''
  switch (l.source) {
    case 'sleep':
      return String(+(l.target / 60).toFixed(2))
    case 'water':
      return units === 'metric' ? String(+(l.target / 1000).toFixed(2)) : String(Math.round(l.target / ML_PER_OZ))
    default:
      return String(l.target)
  }
}

/** A typed number back to the stored unit (steps, minutes, ml, kcal). */
export function targetFromInput(source: LinkSource, value: number, units: UnitSystem): number {
  switch (source) {
    case 'sleep':
      return value * 60
    case 'water':
      return units === 'metric' ? value * 1000 : value * ML_PER_OZ
    default:
      return value
  }
}

/** Unit label next to the form's number. */
export function inputUnit(source: LinkSource, units: UnitSystem): string {
  return { steps: 'steps', sleep: 'hours', water: units === 'metric' ? 'L' : 'oz', calories: '± kcal', protein: '', weighIn: '', workout: '' }[source]
}
