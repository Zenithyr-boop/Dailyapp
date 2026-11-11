/**
 * Logged sessions (Dexie `sessions`, synced to `users/{uid}/sessions`).
 * Every change is written at once, so closing the app or refreshing never
 * loses a set. One session can be in progress at a time (no `finishedAt`).
 * Deleting leaves a tombstone so the deletion reaches other devices.
 */
import { db, type LoggedSet, type Session, type SessionExercise, type WorkoutItem, type WorkoutTemplate } from '../../../lib/db'
import { canEditQuests, dayKeyAt, getDayStartHour, getToday } from '../../../lib/day'
import { refreshAutoQuests } from '../../quests/autoQuests'
import { ensureDay, ensureSetup } from '../../quests/questsRepo'
import type { TrackingType } from '../library/types'
import { targetKind } from '../workouts/targets'
import { lastTimeSets } from './records'

export const newKey = (): string => crypto.randomUUID().slice(0, 8)

export type TrackingOf = (movementId: string) => TrackingType

// ---- Reading ---------------------------------------------------------------------------

/** All sessions (finished or not, no tombstones), newest first. */
export async function listSessions(): Promise<Session[]> {
  return (await db.sessions.orderBy('startedAt').reverse().toArray()).filter((s) => !s.deleted)
}

/** The session in progress, if any. */
export async function getActiveSession(): Promise<Session | undefined> {
  return (await listSessions()).find((s) => !s.finishedAt)
}

export async function getSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id)
  return s && !s.deleted ? s : undefined
}

// ---- Building a session ------------------------------------------------------------

type Target = NonNullable<SessionExercise['target']>

/** Template item → the target a session keeps (no undefined fields). */
export function targetFromItem(item: WorkoutItem): Target {
  const t: Target = { sets: item.sets, restSec: item.restSec }
  if (item.repsMin !== undefined) t.repsMin = item.repsMin
  if (item.repsMax !== undefined) t.repsMax = item.repsMax
  if (item.seconds !== undefined) t.seconds = item.seconds
  if (item.meters !== undefined) t.meters = item.meters
  if (item.rpe !== undefined) t.rpe = item.rpe
  if (item.note) t.note = item.note
  return t
}

/**
 * Set rows for a movement: `count` rows prefilled from last time (set by set;
 * extra rows repeat the last one). Weights carry over; reps are left for the
 * user. Timed and distance rows start from the target.
 */
export function plannedSets(count: number, tracking: TrackingType, last: readonly LoggedSet[], target?: Target): LoggedSet[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const prev = last[i] ?? last.at(-1)
    const set: LoggedSet = { key: newKey(), done: false }
    const kind = targetKind(tracking)
    if (kind === 'reps') {
      if (prev?.kg !== undefined && (tracking === 'weight_reps' || tracking === 'assisted')) set.kg = prev.kg
    } else {
      const seconds = target?.seconds ?? prev?.seconds
      if (seconds !== undefined) set.seconds = seconds
      const meters = kind === 'distance' ? (target?.meters ?? prev?.meters) : undefined
      if (meters !== undefined) set.meters = meters
    }
    return set
  })
}

export function newExercise(
  movementId: string,
  tracking: TrackingType,
  history: readonly Session[],
  item?: WorkoutItem,
): SessionExercise {
  const target = item && targetFromItem(item)
  const ex: SessionExercise = {
    key: newKey(),
    movementId,
    sets: plannedSets(target?.sets ?? 3, tracking, lastTimeSets(history, movementId), target),
  }
  if (target) ex.target = target
  if (item?.group) ex.group = item.group
  return ex
}

export class SessionInProgressError extends Error {
  constructor() {
    super('A session is already in progress')
  }
}

/**
 * Start a session from a workout, or an empty one. Returns its id.
 * `date` = the day it counts toward (a past day when logging an earlier workout; default today).
 */
export async function startSession(
  template: WorkoutTemplate | undefined,
  trackingOf: TrackingOf,
  now = Date.now(),
  date?: string,
): Promise<string> {
  if (await getActiveSession()) throw new SessionInProgressError()
  const history = await listSessions()
  const session: Session = {
    id: crypto.randomUUID(),
    date: date ?? dayKeyAt(now, await getDayStartHour()),
    name: template?.name || 'Workout',
    startedAt: now,
    exercises: (template?.items ?? []).map((item) => newExercise(item.movementId, trackingOf(item.movementId), history, item)),
    updatedAt: now,
  }
  if (template?.id) session.templateId = template.id
  await db.sessions.add(session)
  return session.id
}

/** Read, change and write a session in one transaction. */
export async function updateSession(id: string, change: (s: Session) => Session): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s || s.deleted) return
    await db.sessions.put(change(s))
  })
}

// ---- Pure edits (used with updateSession) ---------------------------------------------

const mapExercise = (s: Session, exKey: string, fn: (e: SessionExercise) => SessionExercise): Session => ({
  ...s,
  exercises: s.exercises.map((e) => (e.key === exKey ? fn(e) : e)),
})

export function patchSet(s: Session, exKey: string, setKey: string, patch: Partial<LoggedSet>): Session {
  return mapExercise(s, exKey, (e) => ({
    ...e,
    sets: e.sets.map((x) => {
      if (x.key !== setKey) return x
      const next = { ...x, ...patch }
      for (const k of Object.keys(next) as (keyof LoggedSet)[]) if (next[k] === undefined) delete next[k]
      return next
    }),
  }))
}

export function setDone(s: Session, exKey: string, setKey: string, done: boolean, now = Date.now()): Session {
  return patchSet(s, exKey, setKey, done ? { done, doneAt: now } : { done, doneAt: undefined })
}

/** Add a set that copies the last one's values (not done). */
export function addSet(s: Session, exKey: string): Session {
  return mapExercise(s, exKey, (e) => {
    const last = e.sets.at(-1)
    const set: LoggedSet = { ...(last ?? {}), key: newKey(), done: false }
    delete set.doneAt
    if (set.reps !== undefined) delete set.reps
    return { ...e, sets: [...e.sets, set] }
  })
}

export function removeSet(s: Session, exKey: string, setKey: string): Session {
  return mapExercise(s, exKey, (e) => ({ ...e, sets: e.sets.filter((x) => x.key !== setKey) }))
}

export function addExercises(s: Session, exercises: SessionExercise[]): Session {
  return { ...s, exercises: [...s.exercises, ...exercises] }
}

export function removeExercise(s: Session, exKey: string): Session {
  return { ...s, exercises: s.exercises.filter((e) => e.key !== exKey) }
}

/**
 * Swap a movement for another, keeping its place, superset and targets.
 * The new movement gets the same number of sets, prefilled from its own history.
 */
export function swapExercise(s: Session, exKey: string, replacement: SessionExercise): Session {
  return mapExercise(s, exKey, (e) => {
    const out: SessionExercise = { ...replacement, key: e.key, sets: replacement.sets.slice(0, e.sets.length) }
    while (out.sets.length < e.sets.length) out.sets.push({ ...out.sets.at(-1)!, key: newKey() })
    if (e.target) out.target = e.target
    if (e.group) out.group = e.group
    return out
  })
}

/** Put one weight on every set not done yet (e.g. a progression suggestion). */
export function applyWeight(s: Session, exKey: string, kg: number): Session {
  return mapExercise(s, exKey, (e) => ({ ...e, sets: e.sets.map((x) => (x.done ? x : { ...x, kg })) }))
}

// ---- Finishing ---------------------------------------------------------------------------

/** `locked` = the session's day is older than yesterday, so its quests can't change any more. */
export type TrainQuestResult = 'checked' | 'already' | 'missing' | 'locked'

/** The day's automatic Workout quest, ticked or not (undefined = there isn't one). */
async function workoutQuestDone(date: string): Promise<boolean | undefined> {
  return (await db.days.get(date))?.quests.find((q) => q.link?.source === 'workout')?.done
}

export function hasDoneSets(s: Session): boolean {
  return s.exercises.some((e) => e.sets.some((x) => x.done))
}

/**
 * Finish a session: keep only the sets that were done (and the movements that
 * have any) and stamp the finish time. The automatic Workout quest of the
 * session's day (the day it started, or the past day it was logged for) ticks
 * itself (`autoQuests.ts`); the result says what happened to it.
 */
export async function finishSession(id: string, now = Date.now()): Promise<TrainQuestResult> {
  const today = await getToday()
  const date = (await getSession(id))?.date ?? (await getToday(now))
  const locked = !canEditQuests(date, today)
  if (!locked) {
    await ensureSetup()
    await ensureDay(date)
  }
  const before = await workoutQuestDone(date)
  await updateSession(id, (s) => ({
    ...s,
    finishedAt: now,
    exercises: s.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length > 0),
  }))
  if (locked) return 'locked'
  if (before === undefined) return 'missing'
  if (before) return 'already'
  await refreshAutoQuests(today)
  return (await workoutQuestDone(date)) ? 'checked' : 'missing'
}

/** Discard (in progress) or delete (finished). */
export async function deleteSession(id: string): Promise<void> {
  await db.sessions.update(id, { deleted: 1 })
}
