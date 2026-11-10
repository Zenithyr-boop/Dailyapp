/**
 * Workout templates: the user's own (Dexie `workouts`, synced to
 * `users/{uid}/workouts`) plus the bundled starters (see `starters.ts`).
 * Deleting leaves a tombstone so the deletion reaches other devices.
 */
import { db, type WorkoutItem, type WorkoutTemplate } from '../../../lib/db'
import { sameContent } from '../../../lib/sync/merge'
import type { TrackingType } from '../library/types'
import { isStarterId, starterById, STARTER_PROGRAMS, STARTERS, type StarterProgram } from './starters'
import { normalizeGroups } from './supersets'
import { fitTarget, kindFromItem, type TargetKind } from './targets'

export const NAME_MAX = 60
export const NOTE_MAX = 300

const FALLBACK_TRACKING: Record<TargetKind, TrackingType> = { reps: 'weight_reps', time: 'time', distance: 'distance_time' }

export interface StarterRow {
  workout: WorkoutTemplate
  /** The user changed it (a stored copy differs from the bundled one). */
  edited: boolean
}

export interface WorkoutLists {
  /** The user's own workouts, newest change first. */
  yours: WorkoutTemplate[]
  /** Starter programs with the starters that weren't deleted (edited copies in place of the originals). */
  programs: { program: StarterProgram; rows: StarterRow[] }[]
  /** Starters the user deleted (can be restored). */
  deletedStarters: number
}

/** Workouts with missing fields filled in (older or foreign records). */
function clean(w: WorkoutTemplate): WorkoutTemplate {
  return { ...w, name: w.name ?? '', items: Array.isArray(w.items) ? w.items : [] }
}

/** Split stored records and starters into what the Train tab shows. Pure. */
export function workoutLists(stored: readonly WorkoutTemplate[]): WorkoutLists {
  const byId = new Map(stored.map((w) => [w.id, w]))
  const yours = stored
    .filter((w) => !w.deleted && !isStarterId(w.id))
    .map(clean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  let deletedStarters = 0
  const programs = STARTER_PROGRAMS.map((program) => {
    const rows: StarterRow[] = []
    for (const starter of program.workouts) {
      const copy = byId.get(starter.id)
      if (copy?.deleted) deletedStarters++
      else if (copy) rows.push({ workout: clean(copy), edited: !sameContent({ ...copy, updatedAt: 0 }, starter) })
      else rows.push({ workout: starter, edited: false })
    }
    return { program, rows }
  }).filter((p) => p.rows.length > 0)
  return { yours, programs, deletedStarters }
}

export async function listStoredWorkouts(): Promise<WorkoutTemplate[]> {
  return db.workouts.toArray()
}

/** A workout to edit: the stored copy, else the bundled starter. Undefined when deleted or unknown. */
export async function getWorkout(id: string): Promise<WorkoutTemplate | undefined> {
  const stored = await db.workouts.get(id)
  if (stored) return stored.deleted ? undefined : clean(stored)
  return starterById(id)
}

export function blankWorkout(): WorkoutTemplate {
  return { id: '', name: '', items: [], updatedAt: 0 }
}

/**
 * Clean a workout before saving: trimmed name and note, targets that fit each
 * movement's tracking type, valid supersets.
 * `trackingOf` returns undefined for a movement that no longer exists; its
 * item keeps the target it has.
 */
export function normalizeWorkout(
  w: Pick<WorkoutTemplate, 'name' | 'note' | 'items'>,
  trackingOf: (movementId: string) => TrackingType | undefined,
): Pick<WorkoutTemplate, 'name' | 'note' | 'items'> {
  const fallback = (item: WorkoutItem) => FALLBACK_TRACKING[kindFromItem(item)]
  const name = w.name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) || 'Untitled workout'
  const note = w.note?.trim().slice(0, NOTE_MAX) || undefined
  const items = normalizeGroups(w.items.map((item) => fitTarget(item, trackingOf(item.movementId) ?? fallback(item))))
  return { name, note, items }
}

/**
 * Save a workout. New workouts (empty id) get one; the id is returned.
 * Saving a starter unchanged stores nothing (it stays a bundled starter).
 */
export async function saveWorkout(w: WorkoutTemplate): Promise<string> {
  const id = w.id || crypto.randomUUID()
  const record: WorkoutTemplate = { id, name: w.name, items: w.items, updatedAt: Date.now() }
  if (w.note) record.note = w.note
  const starter = starterById(id)
  if (starter && !(await db.workouts.get(id)) && sameContent({ ...record, updatedAt: 0 }, starter)) return id
  await db.workouts.put(record)
  return id
}

/** Copy a workout (any kind) as a new workout of the user's. Returns the new id. */
export async function duplicateWorkout(id: string): Promise<string | undefined> {
  const w = await getWorkout(id)
  if (!w) return undefined
  const copy: WorkoutTemplate = {
    ...w,
    id: crypto.randomUUID(),
    name: `${w.name} (copy)`.slice(0, NAME_MAX),
    updatedAt: Date.now(),
  }
  delete copy.dirty
  delete copy.deleted
  await db.workouts.add(copy)
  return copy.id
}

/** Delete (tombstone). A starter gets a tombstone under its fixed id so it stays deleted on every device. */
export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.put({ id, name: '', items: [], deleted: 1, updatedAt: Date.now() })
}

/** Bring deleted starters back as they ship. */
export async function restoreStarters(): Promise<void> {
  const deleted = (await db.workouts.bulkGet(STARTERS.map((s) => s.id))).filter((w) => w?.deleted)
  await db.workouts.bulkPut(deleted.map((w) => ({ ...starterById(w!.id)!, updatedAt: Date.now() })))
}
