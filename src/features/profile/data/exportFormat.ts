/**
 * "Your data" file formats (pure, unit-tested in `exportFormat.test.ts`).
 *
 * JSON export: every synced table, as stored in the cloud (no device-only flags,
 * no deleted records). It's the format Import reads back. Progress photos and the
 * Open Food Facts cache are device-only and never exported.
 *
 * CSV export: spreadsheet-friendly views of the same data, zipped.
 */
import type { Day, FoodEntry, Profile, Session, SyncedTable } from '../../../lib/db'
import { SYNCED_TABLES } from '../../../lib/db'
import { toCsv } from '../../../lib/csv'
import { toCloud } from '../../../lib/sync/merge'
import { dayTotalXp } from '../../../lib/xp'
import { mealName } from '../../food/nutrition'

export const EXPORT_APP = 'FromZero'
/** Bump when the file's shape changes in a way older imports can't read. */
export const EXPORT_FORMAT = 1

export type ExportTables = Partial<Record<SyncedTable, Record<string, unknown>[]>>

export interface ExportFile {
  app: typeof EXPORT_APP
  format: number
  /** ISO time of the export. */
  exportedAt: string
  /** App version that wrote it. */
  version: string
  tables: ExportTables
}

/** Labels for the import summary and the Your data panel. */
export const TABLE_LABELS: Record<SyncedTable, [one: string, many: string]> = {
  profile: ['profile and settings', 'profile and settings'],
  quests: ['quest', 'quests'],
  days: ['day', 'days'],
  workouts: ['workout', 'workouts'],
  sessions: ['logged session', 'logged sessions'],
  food: ['food entry', 'food entries'],
  programs: ['program', 'programs'],
  movements: ['custom movement', 'custom movements'],
  foods: ['custom food', 'custom foods'],
  favorites: ['favourite', 'favourites'],
  savedMeals: ['saved meal', 'saved meals'],
}

export function describeCount(table: SyncedTable, n: number): string {
  const [one, many] = TABLE_LABELS[table]
  if (table === 'profile') return one
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`
}

/** `YYYY-MM-DD` of a local date, for file names. */
export function fileDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Build the JSON export from the device's records (deleted ones are left out). */
export function buildExportFile(records: Record<SyncedTable, object[]>, version: string, now = new Date()): ExportFile {
  const tables: ExportTables = {}
  for (const table of SYNCED_TABLES) {
    tables[table] = records[table]
      .filter((r) => !(r as { deleted?: unknown }).deleted)
      .map((r) => toCloud(r) as Record<string, unknown>)
  }
  return { app: EXPORT_APP, format: EXPORT_FORMAT, exportedAt: now.toISOString(), version, tables }
}

// ---- Reading an export back -------------------------------------------------------

/** A file that can't be imported, with a message for the user. */
export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isArr = Array.isArray
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Just enough shape checking that a damaged or hand-edited record can't break a screen. */
const VALID: Record<SyncedTable, (r: Record<string, unknown>) => boolean> = {
  profile: (r) => r.id === 'me' && isStr(r.displayName) && isStr(r.units) && isObj(r.goals),
  quests: (r) => isStr(r.id) && isStr(r.title) && isNum(r.xp) && isStr(r.kind) && isNum(r.order),
  days: (r) => isStr(r.date) && DATE_RE.test(r.date) && isArr(r.quests) && r.quests.every((q) => isObj(q) && isStr(q.id)),
  workouts: (r) => isStr(r.id) && isStr(r.name) && isArr(r.items),
  sessions: (r) => isStr(r.id) && isStr(r.date) && DATE_RE.test(r.date) && isArr(r.exercises) && isNum(r.startedAt),
  food: (r) => isStr(r.id) && isStr(r.date) && DATE_RE.test(r.date) && isStr(r.meal) && isStr(r.name) && isNum(r.kcal),
  programs: (r) =>
    isStr(r.id) && isStr(r.kind) && isNum(r.length) && isStr(r.startDate) && isArr(r.rules) && isArr(r.attempts) && isArr(r.questIds),
  movements: (r) => isStr(r.id) && isStr(r.name) && isArr(r.primaryMuscles) && isArr(r.instructions),
  foods: (r) => isStr(r.id) && isStr(r.name) && isObj(r.per100) && isArr(r.servings),
  favorites: (r) => isStr(r.id) && isObj(r.food),
  savedMeals: (r) => isStr(r.id) && isStr(r.name) && isArr(r.items),
}

export interface ParsedImport {
  file: ExportFile
  /** Usable records per table. */
  counts: Partial<Record<SyncedTable, number>>
  /** Records left out because they were damaged. */
  skipped: number
}

/** Read an export file. Throws `ImportError` with a plain message when it isn't one. */
export function parseExport(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('That file isn’t a FromZero export. Choose the .json file from Export JSON.')
  }
  if (!isObj(data) || data.app !== EXPORT_APP || !isObj(data.tables)) {
    throw new ImportError('That file isn’t a FromZero export. Choose the .json file from Export JSON.')
  }
  if (!isNum(data.format) || data.format > EXPORT_FORMAT) {
    throw new ImportError('This export was made by a newer version of FromZero. Update the app, then try again.')
  }
  const tables: ExportTables = {}
  const counts: ParsedImport['counts'] = {}
  let skipped = 0
  for (const table of SYNCED_TABLES) {
    const list = (data.tables as Record<string, unknown>)[table]
    if (!isArr(list)) continue
    const ok: Record<string, unknown>[] = []
    for (const r of list) {
      if (isObj(r) && !r.deleted && VALID[table](r)) {
        ok.push({ ...r, updatedAt: isNum(r.updatedAt) ? r.updatedAt : 0 })
      } else skipped++
    }
    if (table === 'profile' && ok.length > 1) ok.length = 1
    tables[table] = ok
    if (ok.length) counts[table] = ok.length
  }
  if (Object.keys(counts).length === 0) {
    throw new ImportError('That export is empty: there’s nothing in it to import.')
  }
  return {
    file: {
      app: EXPORT_APP,
      format: data.format,
      exportedAt: isStr(data.exportedAt) ? data.exportedAt : '',
      version: isStr(data.version) ? data.version : '',
      tables,
    },
    counts,
    skipped,
  }
}

// ---- CSV ---------------------------------------------------------------------------

const r2 = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 100) / 100)

function localDateTime(ms: number | undefined): string | undefined {
  if (!ms) return undefined
  const d = new Date(ms)
  return `${fileDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

export function daysCsv(days: readonly Day[]): string {
  const rows = days
    .filter((d) => !d.deleted)
    .sort(byDate)
    .map((d) => [
      d.date,
      d.quests.filter((q) => q.done).length,
      d.quests.length,
      dayTotalXp(d),
      d.steps,
      d.sleepMinutes,
      d.waterMl,
      r2(d.weightKg),
      r2(d.measurements?.waistCm),
      r2(d.measurements?.chestCm),
      r2(d.measurements?.hipsCm),
      r2(d.measurements?.armCm),
      r2(d.measurements?.thighCm),
    ])
  return toCsv(
    [
      'Date',
      'Quests done',
      'Quests',
      'XP',
      'Steps',
      'Sleep (min)',
      'Water (ml)',
      'Weight (kg)',
      'Waist (cm)',
      'Chest (cm)',
      'Hips (cm)',
      'Arm (cm)',
      'Thigh (cm)',
    ],
    rows,
  )
}

export function questLogCsv(days: readonly Day[]): string {
  const rows = days
    .filter((d) => !d.deleted)
    .sort(byDate)
    .flatMap((d) =>
      d.quests.map((q) => [d.date, q.title, q.link ? 'automatic' : q.kind === 'count' ? 'number' : 'checkbox', q.target, q.unit, q.value, q.done, q.xp]),
    )
  return toCsv(['Date', 'Quest', 'Type', 'Target', 'Unit', 'Amount', 'Done', 'XP'], rows)
}

export function foodCsv(entries: readonly FoodEntry[], profile?: Pick<Profile, 'mealNames'>): string {
  const rows = entries
    .filter((e) => !e.deleted)
    .sort((a, b) => byDate(a, b) || a.loggedAt - b.loggedAt)
    .map((e) => [
      e.date,
      mealName(e.meal, profile),
      localDateTime(e.loggedAt),
      e.name,
      e.brand,
      e.servings !== undefined && e.serving ? `${r2(e.servings)} × ${e.serving.label}` : undefined,
      e.serving?.nominal ? undefined : r2(e.grams),
      Math.round(e.kcal),
      r2(e.proteinG),
      r2(e.carbsG),
      r2(e.fatG),
      e.missing?.length ? e.missing.join(' ') : undefined,
      e.barcode,
    ])
  return toCsv(
    ['Date', 'Meal', 'Logged at', 'Food', 'Brand', 'Servings', 'Grams', 'kcal', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Missing', 'Barcode'],
    rows,
  )
}

export function workoutsCsv(sessions: readonly Session[], movementName: (id: string) => string): string {
  const rows = sessions
    .filter((s) => !s.deleted)
    .sort((a, b) => byDate(a, b) || a.startedAt - b.startedAt)
    .flatMap((s) =>
      s.exercises.flatMap((ex) =>
        ex.sets.map((set, i) => [
          s.date,
          s.name,
          localDateTime(s.startedAt),
          localDateTime(s.finishedAt),
          movementName(ex.movementId),
          i + 1,
          r2(set.kg),
          set.reps,
          set.rpe,
          set.seconds,
          set.meters,
          set.done,
        ]),
      ),
    )
  return toCsv(
    ['Date', 'Workout', 'Started', 'Finished', 'Exercise', 'Set', 'Weight (kg)', 'Reps', 'RPE', 'Seconds', 'Metres', 'Done'],
    rows,
  )
}
