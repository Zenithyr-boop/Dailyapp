/**
 * Reading and saving the profile's body stats, goal and targets (local Dexie;
 * the profile syncs to `users/{uid}` like any other record).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Profile } from '../../../lib/db'
import { heightUnitsOf, type HeightUnits, type UnitSystem } from '../../../lib/units'
import { ensureSetup } from '../../quests/questsRepo'
import { calculateTargets, type BodyStats, type GoalPlan } from './targets'

/** Everything onboarding and Me → Goals edit, as one draft. */
export interface GoalSettings {
  displayName: string
  units: UnitSystem
  heightUnits: HeightUnits
  body: BodyStats
  plan: GoalPlan
  goals: Profile['goals']
}

export const DEFAULT_PLAN: GoalPlan = { goal: 'maintain', rateKgPerWeek: 0 }

/** The profile, or undefined while loading / before first launch set it up. */
export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db.profile.get('me'), [])
}

export function settingsFrom(p: Profile): GoalSettings {
  return {
    displayName: p.displayName,
    units: p.units,
    heightUnits: heightUnitsOf(p),
    body: { ...p.body },
    plan: { ...(p.plan ?? DEFAULT_PLAN) },
    goals: { ...p.goals },
  }
}

/** Drop keys whose value is undefined (keeps stored records tidy and comparable). */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

/**
 * In calculated mode, write the calculated numbers into `goals` (or clear them
 * when there isn't enough to calculate). Custom numbers are left alone.
 */
export function withAutoTargets(s: GoalSettings, year?: number): GoalSettings {
  if (s.goals.macroMode === 'custom') return s
  const t = calculateTargets(s.body, s.plan, year)
  return {
    ...s,
    goals: compact({
      ...s.goals,
      macroMode: t ? ('auto' as const) : undefined,
      kcal: t?.kcal,
      proteinG: t?.proteinG,
      fatG: t?.fatG,
      carbsG: t?.carbsG,
    }),
  }
}

/** Save the draft (recalculating targets) and optionally mark onboarding finished or skipped. */
export async function saveGoalSettings(s: GoalSettings, onboarding?: 'done' | 'skipped'): Promise<void> {
  await ensureSetup()
  const next = withAutoTargets(s)
  const body = compact(next.body)
  // Only store what holds something, so skipping everything leaves the profile
  // as it was (an untouched device simply takes the account's data on sign-in).
  await db.profile.update('me', {
    displayName: next.displayName.trim(),
    units: next.units,
    heightUnits: next.heightUnits === heightUnitsOf({ units: next.units }) ? undefined : next.heightUnits,
    body: Object.keys(body).length ? body : undefined,
    plan: next.plan.goal === 'maintain' ? undefined : next.plan,
    goals: compact(next.goals),
    ...(onboarding ? { onboarding } : {}),
  })
}

/** Stable text of a draft, to tell whether it has unsaved changes. */
export function settingsKey(s: GoalSettings): string {
  return JSON.stringify({ ...s, body: compact(s.body), goals: compact(s.goals), displayName: s.displayName.trim() })
}
