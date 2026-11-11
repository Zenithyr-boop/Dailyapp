import { db, runAsSync } from '../lib/db'

/**
 * Turn the default automatic quests (Train, protein, steps) into plain
 * checkboxes, for tests that tick every quest by hand. Runs as a sync write so
 * no record is flagged for upload.
 */
export async function useManualQuests(): Promise<void> {
  await runAsSync(() =>
    db.quests.toCollection().modify((q) => {
      delete q.link
    }),
  )
}
