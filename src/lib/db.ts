/**
 * Local-first storage (IndexedDB via Dexie). This is the source of truth on the
 * device; Firestore holds a copy when the user is signed in (see `lib/sync`).
 * Tables mirror the Firestore model in CLAUDE.md.
 * Weights are stored in kg; dates as local `YYYY-MM-DD` keys.
 */
import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { TrackingType } from '../features/train/library/types'
import type { Rank } from './rank'
import type { UnitSystem } from './units'

/**
 * Fields every synced record carries. `updatedAt` and `dirty` are set by the
 * hooks at the bottom of this file on every local write, so feature code never
 * has to remember them.
 */
export interface SyncFields {
  /** Last change, ms since epoch (device clock). Newer wins in conflicts. */
  updatedAt: number
  /** 1 = changed on this device and not uploaded yet. Never stored in the cloud. */
  dirty?: 0 | 1
  /** 1 = deleted: a tombstone kept so the deletion reaches other devices. */
  deleted?: 1
}

/**
 * Settings, plus two "high-water marks" that only ever go up.
 * XP, level and streak are never stored: they are worked out from the day
 * history (`progressFromDays` in `lib/xp.ts`), so two devices can't disagree.
 */
export interface Profile extends SyncFields {
  id: 'me'
  displayName: string
  units: UnitSystem
  /** Highest rank earned. Never drops; devices merge it with max. */
  rank: Rank
  /** Highest level already celebrated, so a level-up shows only once. Merged with max. */
  bestLevel: number
  goals: {
    steps?: number
    sleepHours?: number
    waterMl?: number
    kcal?: number
    proteinG?: number
  }
}

/** `check` = simple checkbox; `count` = number target with a + button (e.g. 3 L water). */
export type QuestKind = 'check' | 'count'

/** Fields shared by a quest definition and its daily copy. */
export interface QuestFields {
  title: string
  xp: number
  kind: QuestKind
  /** Count quests only: target amount, unit label and + step. */
  target?: number
  unit?: string
  step?: number
}

/** One of the user's quests (habits). Copied into each day's record. */
export interface QuestDef extends QuestFields, SyncFields {
  id: string
  /** Sort position, ascending. */
  order: number
}

/** A quest as it stood on a given day, with that day's progress. */
export interface Quest extends QuestFields {
  id: string
  /** Count quests only: amount logged so far. */
  value?: number
  done: boolean
  /** When this quest's progress last changed (ms). Lets sync merge a day quest by quest. */
  at?: number
}

export interface Day extends SyncFields {
  /** `YYYY-MM-DD`, local time. */
  date: string
  quests: Quest[]
  steps?: number
  sleepMinutes?: number
  weightKg?: number
  waterMl?: number
}

/**
 * One movement in a workout template. The target fields depend on how the
 * movement is logged (its tracking type): a rep range for weight, bodyweight
 * and assisted movements; seconds for timed ones; time (+ optional distance)
 * for distance movements. See `features/train/workouts/targets.ts`.
 */
export interface WorkoutItem {
  /** Unique within the workout (list keys, superset links). */
  key: string
  movementId: string
  sets: number
  /** Rep-based movements: target rep range, e.g. 6–8. */
  repsMin?: number
  repsMax?: number
  /** Timed movements: seconds per set. Distance movements: target time. */
  seconds?: number
  /** Distance movements: target distance in metres (optional). */
  meters?: number
  /** Target RPE, 5–10 in half steps (optional). */
  rpe?: number
  /** Rest after each set, seconds. Ignored while it leads into the next movement of a superset. */
  restSec: number
  note?: string
  /** Items next to each other with the same group form a superset. */
  group?: string
}

/**
 * A saved workout. Starter templates are bundled with the app and only stored
 * here (same fixed `starter-…` id) once the user edits or deletes one.
 */
export interface WorkoutTemplate extends SyncFields {
  id: string
  name: string
  note?: string
  items: WorkoutItem[]
}

/**
 * One set in a logged session. Which fields are used follows the movement's
 * tracking type: kg + reps (weight_reps; `kg` is the assistance for assisted),
 * reps (bodyweight), seconds (time), seconds + metres (distance). Weights are
 * always stored in kg.
 */
export interface LoggedSet {
  key: string
  done: boolean
  kg?: number
  reps?: number
  rpe?: number
  seconds?: number
  meters?: number
  /** When it was ticked (ms). */
  doneAt?: number
}

/** A movement in a logged session, with the targets it was started with. */
export interface SessionExercise {
  key: string
  movementId: string
  /** Targets copied from the workout template (none for movements added on the fly). */
  target?: Omit<WorkoutItem, 'key' | 'movementId' | 'group'>
  /** Superset group, as in the template. */
  group?: string
  sets: LoggedSet[]
  note?: string
}

export interface Session extends SyncFields {
  id: string
  /** Local day the session started, `YYYY-MM-DD`. */
  date: string
  name: string
  templateId?: string
  /** ms since epoch. */
  startedAt: number
  /** Unset while the session is in progress. */
  finishedAt?: number
  exercises: SessionExercise[]
  notes?: string
}

export interface FoodEntry extends SyncFields {
  id: string
  date: string
  name: string
  barcode?: string
  grams: number
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface ProgramState extends SyncFields {
  id: string
  /** e.g. '66-day-reset', '75-day-challenge', 'custom' */
  kind: string
  startDate: string
  day: number
  strict: boolean
}

/**
 * A movement the user made themselves. The shared library is bundled with the
 * app (`features/train/library`), so only these live in Dexie / Firestore.
 * Ids start with `custom-` so they never collide with library ids.
 */
export interface CustomMovement extends SyncFields {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string
  category: string
  tracking: TrackingType
  instructions: string[]
}

/** Device-only key/value data (sync cursors, pending celebration). Never synced. */
export interface MetaEntry {
  key: string
  value: unknown
}

export type FromZeroDB = Dexie & {
  profile: EntityTable<Profile, 'id'>
  quests: EntityTable<QuestDef, 'id'>
  days: EntityTable<Day, 'date'>
  workouts: EntityTable<WorkoutTemplate, 'id'>
  sessions: EntityTable<Session, 'id'>
  food: EntityTable<FoodEntry, 'id'>
  programs: EntityTable<ProgramState, 'id'>
  movements: EntityTable<CustomMovement, 'id'>
  meta: EntityTable<MetaEntry, 'key'>
}

// IndexedDB name stays 'chalk' (the app's old working name): renaming it would
// orphan every existing device's local data.
export const db = new Dexie('chalk') as FromZeroDB

db.version(1).stores({
  profile: 'id',
  days: 'date',
  workouts: 'id, name',
  sessions: 'id, date, templateId',
  food: 'id, date',
  programs: 'id, kind',
})

db.version(2).stores({
  quests: 'id, order',
})

// v3: account sync. `dirty` is indexed so pending uploads are cheap to find.
// XP/level/streak leave the profile (derived now); the celebration moves to meta.
db.version(3)
  .stores({
    profile: 'id, dirty',
    quests: 'id, order, dirty',
    days: 'date, dirty',
    workouts: 'id, name, dirty',
    sessions: 'id, date, templateId, dirty',
    food: 'id, date, dirty',
    programs: 'id, kind, dirty',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('profile')
      .toCollection()
      .modify((p: Record<string, unknown>) => {
        delete p.totalXp
        delete p.level
        delete p.streak
        delete p.celebration
      })
  })

// v4: the user's custom movements (the shared library is bundled, not stored).
db.version(4).stores({
  movements: 'id, dirty',
})

// v5: logged sessions sort by start time (history) and have a new shape.
// Nothing wrote sessions before v5, so there is nothing to migrate.
db.version(5).stores({
  sessions: 'id, date, templateId, startedAt, dirty',
})

/** Tables that sync to Firestore. */
export const SYNCED_TABLES = ['profile', 'quests', 'days', 'workouts', 'sessions', 'food', 'programs', 'movements'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]
/** Any record of a synced table (Dexie hands these back untyped). */
export type SyncedRecord = SyncFields

/*
 * Every local write to a synced table stamps `updatedAt` and flags the record
 * for upload. Writes made by the sync engine itself (applying cloud data,
 * clearing flags) run inside `runAsSync` and are left as they are.
 */
const syncTransactions = new WeakSet<Transaction>()

function isSyncWrite(tx: Transaction | undefined): boolean {
  if (!tx) return false
  // Nested transactions share their parent's marker.
  for (let t: Transaction | undefined = tx; t; t = (t as Transaction & { parent?: Transaction }).parent) {
    if (syncTransactions.has(t)) return true
  }
  return tx.mode === 'versionchange'
}

/** Run Dexie writes without stamping them as local changes. */
export function runAsSync<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', [...SYNCED_TABLES.map((t) => db.table(t)), db.meta], async (tx) => {
    syncTransactions.add(tx)
    return fn()
  })
}

for (const name of SYNCED_TABLES) {
  const table = db.table(name)
  table.hook('creating', (_key, obj: SyncFields, tx) => {
    if (isSyncWrite(tx)) return
    obj.updatedAt = Date.now()
    obj.dirty = 1
  })
  table.hook('updating', (_mods, _key, _obj, tx) => {
    if (isSyncWrite(tx)) return undefined
    return { updatedAt: Date.now(), dirty: 1 }
  })
}

/** Key of a record in its table (`date` for days, `id` otherwise). */
export function recordKey(table: SyncedTable, record: object): string {
  const r = record as { date?: unknown; id?: unknown }
  return String(table === 'days' ? r.date : r.id)
}

/** Device-only values. */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (value === undefined) await db.meta.delete(key)
  else await db.meta.put({ key, value })
}
