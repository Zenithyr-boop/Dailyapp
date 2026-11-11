import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { normalizeDayStart } from '../../lib/day'
import type { HeightUnits, UnitSystem } from '../../lib/units'
import { ensureSetup } from '../quests/questsRepo'

/** The user's unit system (synced profile setting), metric until loaded. */
export function useUnits(): UnitSystem {
  return useLiveQuery(async () => (await db.profile.get('me'))?.units, []) ?? 'metric'
}

export async function setUnits(units: UnitSystem): Promise<void> {
  await ensureSetup()
  await db.profile.update('me', { units })
}

export async function setHeightUnits(heightUnits: HeightUnits): Promise<void> {
  await ensureSetup()
  await db.profile.update('me', { heightUnits })
}

/** Hour the day starts (0–4). The app's clock follows the profile at once. */
export async function setDayStartHour(hour: number): Promise<void> {
  await ensureSetup()
  await db.profile.update('me', { dayStartHour: normalizeDayStart(hour) })
}
