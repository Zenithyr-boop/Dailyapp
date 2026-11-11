/**
 * Local-first storage (IndexedDB via Dexie). This is the source of truth on the
 * device; Firestore holds a copy when the user is signed in (see `lib/sync`).
 * Tables mirror the Firestore model in CLAUDE.md.
 * Weights are stored in kg; dates as local `YYYY-MM-DD` keys.
 */
import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { BodyStats, GoalPlan } from '../features/profile/goals/targets'
import type { TrackingType } from '../features/train/library/types'
import type { Rank } from './rank'
import type { HeightUnits, UnitSystem } from './units'

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
  /** Weight unit (kg / lb). */
  units: UnitSystem
  /** Height unit; unset = follows `units` (see `heightUnitsOf`). */
  heightUnits?: HeightUnits
  /** First-run flow finished or skipped. Unset = show it (new users only; see v6 below). */
  onboarding?: 'done' | 'skipped'
  /** Sex, birth year, height, weight (kg), activity: the inputs for calorie targets. */
  body?: BodyStats
  /** Lose / maintain / gain and the weekly rate (kg). */
  plan?: GoalPlan
  /** The user's names for the four meals (unset = Breakfast, Lunch, Dinner, Snacks). */
  mealNames?: Partial<Record<MealSlot, string>>
  /** Hour the day starts (0–4; unset = midnight). Before it, time counts toward the previous day. See `lib/day.ts`. */
  dayStartHour?: number
  /** The user's goal weight (kg), set on the Body screen. */
  goalWeightKg?: number
  /** Highest rank earned. Never drops; devices merge it with max. */
  rank: Rank
  /** Highest level already celebrated, so a level-up shows only once. Merged with max. */
  bestLevel: number
  goals: {
    steps?: number
    sleepHours?: number
    waterMl?: number
    /** Daily calorie and macro targets (calculated, or the user's own numbers). */
    kcal?: number
    proteinG?: number
    fatG?: number
    carbsG?: number
    /** 'auto' = calculated from body + plan on every save; 'custom' = the user's own numbers. */
    macroMode?: 'auto' | 'custom'
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

/** Body measurements, all in cm, each optional. */
export type MeasureKey = 'waistCm' | 'chestCm' | 'hipsCm' | 'armCm' | 'thighCm'
export type Measurements = Partial<Record<MeasureKey, number>>
/** The body values a day can hold (weigh-in + measurements). */
export type BodyField = 'weightKg' | MeasureKey

export interface Day extends SyncFields {
  /** `YYYY-MM-DD`, local time. */
  date: string
  /** Empty on a day that only holds body data from before the user's first quest day. */
  quests: Quest[]
  steps?: number
  sleepMinutes?: number
  /** Weigh-in for the day (kg). */
  weightKg?: number
  measurements?: Measurements
  /**
   * When each body value last changed (ms), whether it was set or cleared, so
   * sync merges them value by value and a removed weigh-in stays removed.
   */
  bodyAt?: Partial<Record<BodyField, number>>
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

/** Values per 100 g (per 100 ml for drinks, treated as grams). */
export interface Per100 {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type Nutrient = keyof Per100

/** A named portion of a food, e.g. "1 large" = 50 g. */
export interface Serving {
  label: string
  grams: number
}

/** The four meals of a day. Their names are editable (profile `mealNames`). */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

/**
 * How much of a food was eaten, with a copy of the food's values so the entry
 * (and "log again", saved meals, copying a day) never needs the food itself.
 * Quick add entries have no food: only the totals.
 */
export interface Portion {
  name: string
  brand?: string
  /** `usda-…`, `off-<barcode>` or `custom-…`. Unset for quick add. */
  foodId?: string
  barcode?: string
  /** Amount eaten. Unset for quick add. */
  grams?: number
  /** Logged by servings: how many, and which one. Otherwise by grams. */
  servings?: number
  serving?: Serving
  /** The food's values when it was logged. */
  per100?: Per100
  /** Nutrients the food's data was missing (counted as 0). */
  missing?: Nutrient[]
  /** Totals for this amount. */
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** One line in the food log. */
export interface FoodEntry extends Portion, SyncFields {
  id: string
  /** Local day, `YYYY-MM-DD`. */
  date: string
  meal: MealSlot
  /** When it was logged (ms). Sorts a meal's entries and the recent foods. */
  loggedAt: number
}

/**
 * A food the user made (or their completed copy of an Open Food Facts product
 * whose nutrition was incomplete: `basedOn` = that barcode). Ids start with `custom-`.
 */
export interface CustomFood extends SyncFields {
  id: string
  name: string
  brand?: string
  barcode?: string
  per100: Per100
  servings: Serving[]
  basedOn?: string
}

/** The parts of a food that favourites and the product cache keep, so they work without a lookup. */
export interface FoodSnapshot {
  id: string
  name: string
  brand?: string
  barcode?: string
  per100: Per100
  servings: Serving[]
  missing?: Nutrient[]
  /** kcal worked out from kJ (the product listed only kJ). */
  kcalFromKj?: boolean
}

/** A favourite food, keyed by the food's id. */
export interface FavoriteFood extends SyncFields {
  id: string
  food: FoodSnapshot
  /** When it was starred (ms); newest first. */
  addedAt: number
}

/** A combination of foods logged in one tap. */
export interface SavedMeal extends SyncFields {
  id: string
  name: string
  items: Portion[]
}

/**
 * Device-only cache of Open Food Facts products (every product fetched, from
 * scans and searches), so repeat lookups cost no request and work offline.
 * `food` is null when the barcode wasn't found.
 */
export interface OffProduct {
  barcode: string
  food: FoodSnapshot | null
  fetchedAt: number
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

/** Pose of a progress photo (optional), so compare can match like with like. */
export type PhotoPose = 'front' | 'side' | 'back'

/**
 * A progress photo. Device-only: stored in IndexedDB, never uploaded or synced.
 * Images are kept as bytes (ArrayBuffer) rather than Blobs, which older Safari
 * versions couldn't store in IndexedDB.
 */
export interface ProgressPhoto {
  id: string
  /** Local day the photo is for, `YYYY-MM-DD`. */
  date: string
  pose?: PhotoPose
  /** Small JPEG for grids. The full image is in `photoImages` (same id), so lists stay light. */
  thumb: ArrayBuffer
  type: string
  width: number
  height: number
  /** When it was added (ms). */
  addedAt: number
}

/** The full image of a progress photo: JPEG, longest side at most `PHOTO_MAX_SIDE` px (`features/body/photos/image.ts`). */
export interface PhotoImage {
  id: string
  image: ArrayBuffer
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
  foods: EntityTable<CustomFood, 'id'>
  favorites: EntityTable<FavoriteFood, 'id'>
  savedMeals: EntityTable<SavedMeal, 'id'>
  offProducts: EntityTable<OffProduct, 'barcode'>
  photos: EntityTable<ProgressPhoto, 'id'>
  photoImages: EntityTable<PhotoImage, 'id'>
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

// v6: first-run onboarding. Profiles that already exist belong to people who
// used the app before it had onboarding: mark them done so they never see it,
// and flag the change for upload so their other devices skip it too.
db.version(6)
  .stores({})
  .upgrade(async (tx) => {
    await tx
      .table('profile')
      .toCollection()
      .modify((p: Profile) => {
        if (p.onboarding) return
        p.onboarding = 'done'
        p.updatedAt = Date.now()
        p.dirty = 1
      })
  })

// v7: food logging. Log entries get a meal and a log time (nothing wrote `food`
// before v7). Custom foods, favourites and saved meals sync; the Open Food
// Facts product cache stays on the device.
db.version(7).stores({
  food: 'id, date, loggedAt, dirty',
  foods: 'id, barcode, basedOn, dirty',
  favorites: 'id, dirty',
  savedMeals: 'id, dirty',
  offProducts: 'barcode, fetchedAt',
})

// v8: progress photos. Device-only (not in SYNCED_TABLES): never uploaded.
db.version(8).stores({
  photos: 'id, date, addedAt',
  photoImages: 'id',
})

/** Tables that sync to Firestore. */
export const SYNCED_TABLES = [
  'profile',
  'quests',
  'days',
  'workouts',
  'sessions',
  'food',
  'programs',
  'movements',
  'foods',
  'favorites',
  'savedMeals',
] as const
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
