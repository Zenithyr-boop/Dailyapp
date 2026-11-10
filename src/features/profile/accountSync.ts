/**
 * Connects sign-in to account sync: signed in → sync runs; signed out → it
 * stops and the app keeps working on local data only.
 */
import { authAvailable, watchAuth } from '../../lib/auth'
import { toDayKey } from '../../lib/dates'
import { startSync, stopSync, type SyncOptions } from '../../lib/sync/engine'
import { checkMilestones, DEFAULT_QUESTS, ensureDay } from '../quests/questsRepo'

export const syncOptions: SyncOptions = {
  // Firestore loads on demand, only for signed-in users.
  createRemote: (uid) => import('../../lib/sync/remote').then((m) => m.createFirestoreRemote(uid)),
  defaultQuests: DEFAULT_QUESTS,
  afterRemoteChange: async () => {
    // Levels reached on another device were celebrated there; just record them.
    await checkMilestones(toDayKey(), { celebrate: false })
    await ensureDay()
  },
}

export function initAccountSync(): void {
  if (!authAvailable) return
  watchAuth((user) => (user ? startSync(user.uid, syncOptions) : stopSync()))
}
