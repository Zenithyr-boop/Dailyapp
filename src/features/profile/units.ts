import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { ensureSetup } from '../quests/questsRepo'

/** The user's unit system (synced profile setting), metric until loaded. */
export function useUnits(): UnitSystem {
  return useLiveQuery(async () => (await db.profile.get('me'))?.units, []) ?? 'metric'
}

export async function setUnits(units: UnitSystem): Promise<void> {
  await ensureSetup()
  await db.profile.update('me', { units })
}
