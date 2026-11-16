/**
 * "Your data" (Me screen): export everything as JSON or CSV, and import a JSON export.
 *
 * Import merges, it never deletes: each record goes through the same merge rules as
 * sync (`lib/sync/merge.ts`), with the file in the role of the cloud copy and the file's
 * settings and quest definitions winning (it's a restore the user asked for). Day ticks
 * merge as "checked on either counts". Changed records are flagged for upload, so a
 * signed-in device copies the import to the account.
 */
import { db, recordKey, runAsSync, SYNCED_TABLES, type Day, type QuestDef, type SyncedRecord, type SyncedTable } from '../../../lib/db'
import { BUILD_INFO } from '../../../lib/buildInfo'
import { makeZip } from '../../../lib/zip'
import { isPristine, matchQuests, mergeRecord, remapDay, sameContent, toCloud } from '../../../lib/sync/merge'

import { loadLibrary } from '../../train/library/catalog'
import { closeOutDays } from '../../quests/closeOut'
import { freshQuest } from '../../quests/progress'
import { checkMilestones, DEFAULT_QUESTS } from '../../quests/questsRepo'
import {
  buildExportFile,
  daysCsv,
  fileDate,
  foodCsv,
  questLogCsv,
  workoutsCsv,
  type ParsedImport,
} from './exportFormat'

async function readAll(): Promise<Record<SyncedTable, object[]>> {
  const entries = await Promise.all(SYNCED_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const))
  return Object.fromEntries(entries) as Record<SyncedTable, object[]>
}

export interface ExportResult {
  name: string
  mime: string
  data: string | Uint8Array
}

export async function exportJson(now = new Date()): Promise<ExportResult> {
  const file = buildExportFile(await readAll(), BUILD_INFO.version, now)
  return {
    name: `FromZero-export-${fileDate(now)}.json`,
    mime: 'application/json',
    data: JSON.stringify(file, null, 1),
  }
}

export async function exportCsvZip(now = new Date()): Promise<ExportResult> {
  const [days, food, sessions, profile, custom] = await Promise.all([
    db.days.toArray(),
    db.food.toArray(),
    db.sessions.toArray(),
    db.profile.get('me'),
    db.movements.toArray(),
  ])
  // Names for movement ids: custom movements, then the bundled library (loaded only if needed).
  const names = new Map<string, string>(custom.map((m) => [m.id, m.name]))
  if (sessions.length) {
    const library = await loadLibrary().catch(() => [])
    for (const m of library) if (!names.has(m.id)) names.set(m.id, m.name)
  }
  const zip = makeZip(
    [
      { name: 'days.csv', content: daysCsv(days) },
      { name: 'quests.csv', content: questLogCsv(days) },
      { name: 'food.csv', content: foodCsv(food, profile) },
      { name: 'workouts.csv', content: workoutsCsv(sessions, (id) => names.get(id) ?? id) },
    ],
    now,
  )
  return { name: `FromZero-export-${fileDate(now)}-csv.zip`, mime: 'application/zip', data: zip }
}

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
}

/** Merge a parsed export into this device. */
export async function importData(parsed: ParsedImport, now = Date.now()): Promise<ImportResult> {
  const { tables } = parsed.file
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 }

  await runAsSync(async () => {
    // Quests with the same name and type become one (a fresh device's starter quests
    // and the export's), like a first sign-in. An untouched device takes the file's
    // quests as they are.
    const importedQuests = (tables.quests ?? []) as unknown as QuestDef[]
    if (importedQuests.length) {
      const [profile, quests, days, others] = await Promise.all([
        db.profile.get('me'),
        db.quests.toArray(),
        db.days.toArray(),
        Promise.all(
          SYNCED_TABLES.filter((t) => t !== 'profile' && t !== 'quests' && t !== 'days').map((t) => db.table(t).count()),
        ).then((c) => c.reduce((a, b) => a + b, 0)),
      ])
      const pristine = isPristine({ profile, quests, days, otherRecords: others }, DEFAULT_QUESTS)
      const ids = pristine
        ? new Map(quests.filter((q) => !q.deleted).map((q) => [q.id, '']))
        : matchQuests(quests, importedQuests)
      for (const [localId, importedId] of ids) {
        const q = quests.find((x) => x.id === localId)
        // Tombstone, not delete: a signed-in device may already have it in the cloud.
        if (q) await db.quests.put({ ...q, deleted: 1, updatedAt: now, dirty: 1 })
        if (!importedId) ids.delete(localId)
      }
      // An untouched device's days (just today, usually) hold starter quests with no progress:
      // they take the file's quests instead (the file's copy of the day, if it has one).
      const fileDays = new Set(((tables.days ?? []) as unknown as Day[]).map((d) => d.date))
      const fileDefs = importedQuests.filter((q) => !q.deleted).sort((a, b) => a.order - b.order)
      for (const d of days) {
        const remapped = pristine
          ? { ...d, quests: fileDays.has(d.date) ? [] : fileDefs.map(freshQuest) }
          : remapDay(d, ids)
        if (remapped !== d) await db.days.put({ ...remapped, updatedAt: now, dirty: 1 })
      }
    }

    for (const table of SYNCED_TABLES) {
      const t = db.table(table)
      for (const raw of tables[table] ?? []) {
        const incoming = toCloud(raw) as unknown as SyncedRecord
        const key = recordKey(table, incoming)
        const local = (await t.get(key)) as SyncedRecord | undefined
        if (!local) {
          await t.put({ ...incoming, dirty: 1 })
          result.added++
          continue
        }
        const merged = toCloud(mergeRecord(table, local, incoming, { concurrent: true, preferRemote: true }))
        if (sameContent(merged, local)) {
          result.unchanged++
          continue
        }
        await t.put({ ...merged, updatedAt: Math.max(now, local.updatedAt + 1), dirty: 1 })
        result.updated++
      }
    }
  })

  // Levels in the file were celebrated when they happened; then close out the days since.
  await checkMilestones(undefined, { celebrate: false })
  await closeOutDays()
  return result
}
