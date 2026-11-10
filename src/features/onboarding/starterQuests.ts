/**
 * Quests offered on the last onboarding step. The coach can edit this list.
 * `on` = ticked by default. Everything can be changed later in Quests → Edit quests.
 */
import type { QuestFields } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { DEFAULT_QUESTS } from '../quests/questsRepo'

export interface StarterQuest {
  fields: QuestFields
  on: boolean
  /** Short hint shown under the quest. */
  hint?: string
}

const HINTS: Record<string, string> = {
  Train: 'Ticks itself when you finish a workout',
}

export function starterQuests(units: UnitSystem): StarterQuest[] {
  const water: QuestFields =
    units === 'metric'
      ? { title: 'Drink 3 L water', xp: 30, kind: 'count', target: 3, unit: 'L', step: 0.25 }
      : { title: 'Drink 100 oz water', xp: 30, kind: 'count', target: 100, unit: 'oz', step: 10 }
  return [
    ...DEFAULT_QUESTS.map((fields) => ({ fields, on: true, hint: HINTS[fields.title] })),
    { fields: water, on: false, hint: 'A number target with a + button' },
    { fields: { title: 'Log all food', xp: 40, kind: 'check' }, on: false },
    { fields: { title: 'Hit calorie target', xp: 40, kind: 'check' }, on: false },
    { fields: { title: '10 min mobility', xp: 30, kind: 'check' }, on: false },
    { fields: { title: 'No alcohol', xp: 30, kind: 'check' }, on: false },
    { fields: { title: '5 min breathing or meditation', xp: 20, kind: 'check' }, on: false },
  ]
}
