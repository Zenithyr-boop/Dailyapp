/**
 * Closing out days. Runs when the app opens, when the day changes while it's
 * open, and after sync brings in another device's days.
 *
 * XP, the all-quests bonus, level and streak are never stored: they're derived
 * from the day records (`progressFromDays` in `lib/xp.ts`). Closing a day
 * therefore means making sure the record is right:
 * - a day the app was open on keeps its record as it is (frozen: quest edits
 *   only reach today; ticks are allowed today and yesterday, see `canEditQuests`);
 * - a day the app was NOT opened on gets a record with every quest unchecked,
 *   so the miss is on record (history shows which quests were missed) and the
 *   streak breaks there;
 * - today gets its record, starting every quest unchecked.
 * Gap records hold no progress, so merging them with another device's copy of
 * the same day never removes a tick (`mergeDay` keeps the newest change per quest).
 */
import { addDays, getToday } from '../../lib/day'
import { db, type Day } from '../../lib/db'
import { freshQuest } from './progress'
import { checkMilestones, ensureDay, ensureSetup, listQuestDefs } from './questsRepo'

/** Gaps longer than this are only filled for the most recent days (older ones still count as missed). */
export const MAX_BACKFILL_DAYS = 90

/**
 * Record every day missed since the last day on record, then start today.
 * Returns the keys of the missed days it recorded (oldest first).
 */
export async function closeOutDays(today?: string): Promise<string[]> {
  const key = today ?? (await getToday())
  await ensureSetup()
  const created = await db.transaction('rw', db.days, db.quests, async () => {
    const last = await db.days
      .where('date')
      .below(key)
      .reverse()
      // Body-only records (weigh-ins logged for days before the user started) don't count.
      .filter((d) => !d.deleted && d.quests.length > 0)
      .first()
    if (!last) return [] // a new user: nothing before today to close

    let start = addDays(last.date, 1)
    const earliest = addDays(key, -MAX_BACKFILL_DAYS)
    if (start < earliest) start = earliest
    const dates: string[] = []
    for (let d = start; d < key; d = addDays(d, 1)) dates.push(d)
    if (dates.length === 0) return []

    // Never overwrite a record that exists (e.g. a deleted one).
    const existing = await db.days.bulkGet(dates)
    const defs = await listQuestDefs()
    const now = Date.now()
    const rows: Day[] = dates
      .filter((_, i) => !existing[i])
      .map((date) => ({ date, quests: defs.map(freshQuest), updatedAt: now }))
    if (rows.length) await db.days.bulkPut(rows)
    return rows.map((r) => r.date)
  })
  await ensureDay(key)
  await checkMilestones(key)
  return created
}
