/**
 * Quests offered on the last onboarding step. The coach can edit this list.
 * `on` = ticked by default. Everything can be changed later in Quests → Edit quests.
 */
import type { QuestFields } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { ML_PER_OZ } from '../quests/links'
import { DEFAULT_QUESTS } from '../quests/questsRepo'

export interface StarterQuest {
  fields: QuestFields
  on: boolean
  /** Short hint shown under the quest. */
  hint?: string
}

const HINTS: Record<string, string> = {
  Train: 'Automatic: ticks when you finish a workout',
  'Hit protein goal': 'Automatic: ticks when your food reaches your protein goal',
  'Walk 8,000 steps': 'Automatic: ticks from the steps you log (or your phone, in the Android app)',
}

export function starterQuests(units: UnitSystem): StarterQuest[] {
  const water: QuestFields =
    units === 'metric'
      ? { title: 'Drink 3 L water', xp: 30, kind: 'check', link: { source: 'water', target: 3000 } }
      : { title: 'Drink 100 oz water', xp: 30, kind: 'check', link: { source: 'water', target: Math.round(100 * ML_PER_OZ) } }
  return [
    ...DEFAULT_QUESTS.map((fields) => ({ fields, on: true, hint: HINTS[fields.title] })),
    { fields: water, on: false, hint: 'Automatic: ticks from the water you add' },
    { fields: { title: 'Log all food', xp: 40, kind: 'check' }, on: false },
    {
      fields: { title: 'Hit calorie target', xp: 40, kind: 'check', link: { source: 'calories', target: 150 } },
      on: false,
      hint: 'Automatic: ticks when the day’s food is within 150 kcal of your target',
    },
    { fields: { title: 'Weigh in', xp: 20, kind: 'check', link: { source: 'weighIn' } }, on: false, hint: 'Automatic: ticks when you log a weigh-in' },
    { fields: { title: '10 min mobility', xp: 30, kind: 'check' }, on: false },
    { fields: { title: 'No alcohol', xp: 30, kind: 'check' }, on: false },
    { fields: { title: '5 min breathing or meditation', xp: 20, kind: 'check' }, on: false },
  ]
}
