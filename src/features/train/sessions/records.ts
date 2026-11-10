/**
 * Session maths: estimated 1RM, personal records, "last time", totals.
 * Pure functions, unit-tested in `sessions.test.ts`.
 */
import type { LoggedSet, Session } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import type { TrackingType } from '../library/types'
import { formatSeconds } from '../workouts/targets'
import { displayWeight, formatNumber, formatWeight } from './weights'

const EPS = 1e-6

/** Estimated one-rep max (Epley): weight × (1 + reps / 30); a single is the weight itself. */
export function e1rm(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0
  return reps === 1 ? kg : kg * (1 + reps / 30)
}

const doneSets = (sets: readonly LoggedSet[]) => sets.filter((s) => s.done)

/** Done sets of a movement in a session (all its entries, e.g. added twice). */
export function setsFor(session: Session, movementId: string): LoggedSet[] {
  return session.exercises.filter((e) => e.movementId === movementId).flatMap((e) => doneSets(e.sets))
}

/** Finished sessions, newest first, that logged this movement (excluding `exceptId`). */
export function sessionsWith(sessions: readonly Session[], movementId: string, exceptId?: string): Session[] {
  return sessions
    .filter((s) => s.finishedAt && !s.deleted && s.id !== exceptId && setsFor(s, movementId).length > 0)
    .sort((a, b) => b.startedAt - a.startedAt)
}

/** The sets from the most recent finished session with this movement. */
export function lastTimeSets(sessions: readonly Session[], movementId: string, exceptId?: string): LoggedSet[] {
  const last = sessionsWith(sessions, movementId, exceptId)[0]
  return last ? setsFor(last, movementId) : []
}

/** One set as text: "80×8", "12 reps", "45 s", "2 km in 10:00". */
export function formatSet(set: LoggedSet, tracking: TrackingType, units: UnitSystem): string {
  switch (tracking) {
    case 'weight_reps':
      return `${formatNumber(displayWeight(set.kg ?? 0, units))}×${set.reps ?? 0}`
    case 'assisted':
      return set.kg ? `−${formatNumber(displayWeight(set.kg, units))}×${set.reps ?? 0}` : `${set.reps ?? 0} reps`
    case 'bodyweight_reps':
      return `${set.reps ?? 0} reps`
    case 'time':
      return formatSeconds(set.seconds ?? 0)
    case 'distance_time': {
      const time = formatSeconds(set.seconds ?? 0)
      if (!set.meters) return time
      const dist = set.meters >= 1000 ? `${+(set.meters / 1000).toFixed(2)} km` : `${set.meters} m`
      return `${dist} in ${time}`
    }
  }
}

/** "80×8 · 80×7 · 80×6". */
export function formatSets(sets: readonly LoggedSet[], tracking: TrackingType, units: UnitSystem): string {
  return sets.map((s) => formatSet(s, tracking, units)).join(' · ')
}

// ---- Personal records ---------------------------------------------------------------

export type RecordKind = 'heaviest' | 'repsAtWeight' | 'e1rm' | 'mostReps' | 'longest' | 'farthest'

export interface PersonalRecord {
  movementId: string
  kind: RecordKind
  /** The new best (kg, reps, kg of e1RM, seconds or metres). */
  value: number
  /** The best before this session. */
  previous: number
  /** For repsAtWeight: the weight, kg. */
  kg?: number
}

export interface Bests {
  heaviest: number
  e1rm: number
  mostReps: number
  longest: number
  farthest: number
  /** Most reps at each weight (kg rounded to 0.01 as the key). */
  repsAt: Map<string, number>
}

const weightKey = (kg: number) => kg.toFixed(2)

export function bestsOf(sets: readonly LoggedSet[]): Bests {
  const b: Bests = { heaviest: 0, e1rm: 0, mostReps: 0, longest: 0, farthest: 0, repsAt: new Map() }
  for (const s of sets) {
    const kg = s.kg ?? 0
    const reps = s.reps ?? 0
    b.heaviest = Math.max(b.heaviest, reps > 0 ? kg : 0)
    b.e1rm = Math.max(b.e1rm, e1rm(kg, reps))
    b.mostReps = Math.max(b.mostReps, reps)
    b.longest = Math.max(b.longest, s.seconds ?? 0)
    b.farthest = Math.max(b.farthest, s.meters ?? 0)
    if (kg > 0 && reps > 0) {
      const k = weightKey(kg)
      b.repsAt.set(k, Math.max(b.repsAt.get(k) ?? 0, reps))
    }
  }
  return b
}

/**
 * Records this session set for one movement, compared with everything logged
 * before it. Nothing counts as a record the first time a movement is logged.
 */
export function movementRecords(
  movementId: string,
  tracking: TrackingType,
  now: readonly LoggedSet[],
  before: readonly LoggedSet[],
): PersonalRecord[] {
  if (!now.length || !before.length) return []
  const n = bestsOf(now)
  const p = bestsOf(before)
  const out: PersonalRecord[] = []
  const beat = (kind: RecordKind, value: number, previous: number) => {
    if (value > previous + EPS && value > 0) out.push({ movementId, kind, value, previous })
  }
  if (tracking === 'weight_reps') {
    beat('heaviest', n.heaviest, p.heaviest)
    // Most reps at a weight lifted before: report the heaviest such weight.
    const atWeight = [...n.repsAt]
      .filter(([k, reps]) => p.repsAt.has(k) && reps > p.repsAt.get(k)!)
      .sort(([a], [b]) => Number(b) - Number(a))[0]
    if (atWeight) {
      out.push({ movementId, kind: 'repsAtWeight', value: atWeight[1], previous: p.repsAt.get(atWeight[0])!, kg: Number(atWeight[0]) })
    }
    beat('e1rm', n.e1rm, p.e1rm)
  } else if (tracking === 'bodyweight_reps' || tracking === 'assisted') {
    beat('mostReps', n.mostReps, p.mostReps)
  } else if (tracking === 'time') {
    beat('longest', n.longest, p.longest)
  } else {
    beat('farthest', n.farthest, p.farthest)
  }
  return out
}

/** All records set in `session`, compared with finished sessions that started before it. */
export function sessionRecords(
  session: Session,
  all: readonly Session[],
  trackingOf: (movementId: string) => TrackingType,
): PersonalRecord[] {
  const earlier = all.filter((s) => s.finishedAt && !s.deleted && s.id !== session.id && s.startedAt < session.startedAt)
  const ids = [...new Set(session.exercises.map((e) => e.movementId))]
  return ids.flatMap((id) =>
    movementRecords(id, trackingOf(id), setsFor(session, id), earlier.flatMap((s) => setsFor(s, id))),
  )
}

export function formatRecord(r: PersonalRecord, units: UnitSystem): string {
  switch (r.kind) {
    case 'heaviest':
      return `Heaviest: ${formatWeight(r.value, units)} (was ${formatWeight(r.previous, units)})`
    case 'repsAtWeight':
      return `Most reps at ${formatWeight(r.kg!, units)}: ${r.value} (was ${r.previous})`
    case 'e1rm':
      return `Best est. 1RM: ${formatWeight(r.value, units)} (was ${formatWeight(r.previous, units)})`
    case 'mostReps':
      return `Most reps: ${r.value} (was ${r.previous})`
    case 'longest':
      return `Longest: ${formatSeconds(r.value)} (was ${formatSeconds(r.previous)})`
    case 'farthest':
      return `Farthest: ${r.value} m (was ${r.previous} m)`
  }
}

// ---- Totals --------------------------------------------------------------------------

export interface SessionTotals {
  /** ms */
  duration: number
  /** Σ kg × reps over done weighted sets. */
  volumeKg: number
  setsDone: number
}

export function sessionTotals(session: Session, trackingOf: (movementId: string) => TrackingType, now = Date.now()): SessionTotals {
  let volumeKg = 0
  let setsDone = 0
  for (const ex of session.exercises) {
    const weighted = trackingOf(ex.movementId) === 'weight_reps'
    for (const s of doneSets(ex.sets)) {
      setsDone++
      if (weighted) volumeKg += (s.kg ?? 0) * (s.reps ?? 0)
    }
  }
  return { duration: Math.max(0, (session.finishedAt ?? now) - session.startedAt), volumeKg, setsDone }
}

/** 1 h 05 → "1:05:00", 23 min 4 s → "23:04". */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

/** Per finished session: the best estimated 1RM for a movement (for the chart). */
export function e1rmHistory(sessions: readonly Session[], movementId: string): { date: string; startedAt: number; kg: number }[] {
  return sessionsWith(sessions, movementId)
    .map((s) => ({ date: s.date, startedAt: s.startedAt, kg: bestsOf(setsFor(s, movementId)).e1rm }))
    .filter((p) => p.kg > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
}

