import type { LoggedSet, Session, SessionExercise } from '../../../lib/db'
import { INCREASE_KG, progressionHint } from './progression'
import {
  e1rm,
  e1rmHistory,
  formatClock,
  formatSets,
  lastTimeSets,
  movementRecords,
  sessionRecords,
  sessionTotals,
} from './records'
import { displayWeight, plateRoundKg, roundToStep, weightToKg } from './weights'

const set = (kg: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ key: `${kg}-${reps}`, done: true, kg, reps, ...extra })
const squat = { tracking: 'weight_reps' as const, primaryMuscles: ['quadriceps'] }
const bench = { tracking: 'weight_reps' as const, primaryMuscles: ['chest'] }
const exercise = (sets: LoggedSet[], target = { sets: 3, repsMin: 6, repsMax: 8, rpe: 8, restSec: 150 }): SessionExercise => ({
  key: 'e',
  movementId: 'x',
  target,
  sets,
})

describe('progression rule', () => {
  it('adds weight when every set hit the top of the range at or below target RPE', () => {
    const ex = exercise([set(100, 8, { rpe: 8 }), set(100, 8, { rpe: 7.5 }), set(100, 8)])
    expect(progressionHint(ex, squat)).toEqual({ action: 'increase', fromKg: 100, toKg: 102.5, byKg: INCREASE_KG.lowerBody })
    expect(progressionHint(ex, bench)).toMatchObject({ action: 'increase', toKg: 101.25, byKg: INCREASE_KG.upperBody })
  })

  it('keeps the weight otherwise', () => {
    expect(progressionHint(exercise([set(100, 8), set(100, 7), set(100, 6)]), squat)).toMatchObject({ action: 'keep', kg: 100 })
    expect(progressionHint(exercise([set(100, 8, { rpe: 9 }), set(100, 8), set(100, 8)]), squat)).toMatchObject({
      action: 'keep',
      reason: 'RPE went above 8',
    })
    expect(progressionHint(exercise([set(100, 8), set(100, 8)]), squat)).toMatchObject({ action: 'keep', reason: '2 of 3 sets done' })
  })

  it('does not apply without a rep range or to unweighted movements', () => {
    expect(progressionHint({ ...exercise([set(100, 8)]), target: undefined }, squat)).toBeUndefined()
    expect(progressionHint(exercise([set(0, 12)]), { tracking: 'bodyweight_reps', primaryMuscles: ['chest'] })).toBeUndefined()
  })
})

describe('weights and plates', () => {
  it('keeps typed values exact in either unit', () => {
    expect(displayWeight(weightToKg(185, 'imperial'), 'imperial')).toBe(185)
    expect(displayWeight(weightToKg(187.5, 'imperial'), 'imperial')).toBe(187.5)
    expect(displayWeight(82.5, 'metric')).toBe(82.5)
  })

  it('rounds converted values to a plate increment', () => {
    expect(displayWeight(80, 'imperial')).toBe(177.5) // 176.37 lb
    expect(displayWeight(weightToKg(185, 'imperial'), 'metric')).toBe(83.75) // 83.91 kg
    expect(roundToStep(82.49999, 1.25)).toBe(82.5)
    expect(displayWeight(plateRoundKg(101.3, 'metric'), 'metric')).toBe(101.25)
  })
})

describe('records', () => {
  it('estimates 1RM with Epley', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 2)
    expect(e1rm(100, 0)).toBe(0)
  })

  it('finds heaviest, most reps at a weight and best e1RM', () => {
    const before = [set(100, 5), set(100, 5), set(90, 8)]
    const now = [set(102.5, 3), set(100, 6)]
    const records = movementRecords('sq', 'weight_reps', now, before)
    expect(records.map((r) => r.kind)).toEqual(['heaviest', 'repsAtWeight', 'e1rm'])
    expect(records[1]).toMatchObject({ kg: 100, value: 6, previous: 5 })
    expect(records[2]!.value).toBeCloseTo(120)
  })

  it('has no records the first time, and uses reps / time for other tracking types', () => {
    expect(movementRecords('sq', 'weight_reps', [set(100, 5)], [])).toEqual([])
    expect(movementRecords('pu', 'bodyweight_reps', [set(0, 12)], [set(0, 10)])).toEqual([
      { movementId: 'pu', kind: 'mostReps', value: 12, previous: 10 },
    ])
    const hold = (seconds: number): LoggedSet => ({ key: String(seconds), done: true, seconds })
    expect(movementRecords('pl', 'time', [hold(60)], [hold(45)])[0]).toMatchObject({ kind: 'longest', value: 60 })
  })

  const session = (id: string, startedAt: number, sets: LoggedSet[], finished = true): Session => ({
    id,
    date: '2026-11-10',
    name: 'Legs',
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : undefined,
    exercises: [{ key: 'a', movementId: 'Barbell_Squat', sets }],
    updatedAt: startedAt,
  })

  it('reads last time from the newest finished session', () => {
    const all = [session('old', 1, [set(90, 8)]), session('new', 2, [set(100, 8), set(100, 7)]), session('live', 3, [set(110, 1)], false)]
    const last = lastTimeSets(all, 'Barbell_Squat', 'live')
    expect(formatSets(last, 'weight_reps', 'metric')).toBe('100×8 · 100×7')
    expect(formatSets([set(80, 8)], 'weight_reps', 'imperial')).toBe('177.5×8')
  })

  it('compares a session only with earlier ones, and charts e1RM over time', () => {
    const all = [session('a', 1, [set(100, 5)]), session('b', 2, [set(105, 5)]), session('c', 3, [set(110, 5)])]
    expect(sessionRecords(all[1]!, all, () => 'weight_reps').map((r) => r.kind)).toEqual(['heaviest', 'e1rm'])
    expect(sessionRecords(all[0]!, all, () => 'weight_reps')).toEqual([])
    expect(e1rmHistory(all, 'Barbell_Squat').map((p) => Math.round(p.kg))).toEqual([117, 123, 128])
  })

  it('totals duration, volume and sets done', () => {
    const s = session('a', 0, [set(100, 5), set(100, 5), { key: 'x', done: false, kg: 100 }])
    expect(sessionTotals(s, () => 'weight_reps')).toEqual({ duration: 3_600_000, volumeKg: 1000, setsDone: 2 })
    expect(formatClock(23 * 60_000 + 4000)).toBe('23:04')
    expect(formatClock(3_900_000)).toBe('1:05:00')
  })
})
