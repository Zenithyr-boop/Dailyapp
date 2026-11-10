import { db } from '../../../lib/db'
import { ensureDay, ensureSetup } from '../../quests/questsRepo'
import { TRACKING } from '../library/trackingTypes'
import { starterById } from '../workouts/starters'
import {
  addSet,
  finishSession,
  getActiveSession,
  getSession,
  newExercise,
  patchSet,
  SessionInProgressError,
  setDone,
  startSession,
  swapExercise,
  updateSession,
} from './sessionsRepo'

const trackingOf = (id: string) => TRACKING[id] ?? 'weight_reps'
const today = '2026-11-10'

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${today}T18:00:00`))
})

afterEach(() => vi.useRealTimers())

/** Log every set of the first movement as kg × reps and finish. */
async function logAndFinish(id: string, kg: number, reps: number) {
  await updateSession(id, (s) => {
    let next = s
    const ex = s.exercises[0]!
    for (const x of ex.sets) next = setDone(patchSet(next, ex.key, x.key, { kg, reps }), ex.key, x.key, true)
    return next
  })
  return finishSession(id)
}

describe('sessions repo', () => {
  it('starts from a workout with its targets, one row per planned set', async () => {
    const id = await startSession(starterById('starter-fb-a'), trackingOf)
    const s = (await getSession(id))!
    expect(s.name).toBe('Full Body A')
    expect(s.templateId).toBe('starter-fb-a')
    expect(s.exercises.map((e) => e.movementId)).toEqual([
      'Barbell_Squat',
      'Barbell_Bench_Press_-_Medium_Grip',
      'Bent_Over_Barbell_Row',
      'Plank',
    ])
    expect(s.exercises[0]!.sets).toHaveLength(3)
    expect(s.exercises[0]!.target).toMatchObject({ sets: 3, repsMin: 5, repsMax: 8, rpe: 8, restSec: 180 })
    expect(s.exercises[3]!.sets[0]).toMatchObject({ seconds: 30, done: false }) // timed: target seconds
    expect(await getActiveSession()).toMatchObject({ id })
    await expect(startSession(undefined, trackingOf)).rejects.toBeInstanceOf(SessionInProgressError)
  })

  it('saves each tick at once, so a reload finds it', async () => {
    const id = await startSession(starterById('starter-fb-a'), trackingOf)
    const ex = (await getSession(id))!.exercises[0]!
    const tickedAt = Date.now()
    await updateSession(id, (s) => setDone(patchSet(s, ex.key, ex.sets[0]!.key, { kg: 100, reps: 5 }), ex.key, ex.sets[0]!.key, true, tickedAt))
    db.close()
    await db.open()
    const saved = (await getSession(id))!.exercises[0]!.sets[0]!
    expect(saved).toMatchObject({ kg: 100, reps: 5, done: true, doneAt: tickedAt })
    expect((await db.sessions.get(id))?.dirty).toBe(1) // queued for sync
  })

  it('prefills weights from last time', async () => {
    const first = await startSession(starterById('starter-fb-a'), trackingOf)
    await logAndFinish(first, 100, 8)
    vi.setSystemTime(new Date('2026-11-12T18:00:00'))
    const second = await startSession(starterById('starter-fb-a'), trackingOf)
    const squat = (await getSession(second))!.exercises[0]!
    expect(squat.sets.map((x) => x.kg)).toEqual([100, 100, 100])
    expect(squat.sets.every((x) => x.reps === undefined && !x.done)).toBe(true)
  })

  it('finishes: keeps done sets only and ticks the Train quest once', async () => {
    await ensureSetup()
    await ensureDay(today)
    const id = await startSession(starterById('starter-fb-a'), trackingOf)
    await updateSession(id, (s) => {
      const ex = s.exercises[1]!
      return setDone(patchSet(s, ex.key, ex.sets[0]!.key, { kg: 60, reps: 8 }), ex.key, ex.sets[0]!.key, true)
    })
    const finishedAt = Date.now()
    expect(await finishSession(id, finishedAt)).toBe('checked')
    const s = (await getSession(id))!
    expect(s.finishedAt).toBe(finishedAt)
    expect(s.exercises.map((e) => e.sets.length)).toEqual([1])
    const train = (await db.days.get(today))!.quests.find((q) => q.title === 'Train')!
    expect(train.done).toBe(true)
    expect(await getActiveSession()).toBeUndefined()

    const again = await startSession(starterById('starter-fb-b'), trackingOf)
    expect(await logAndFinish(again, 140, 5)).toBe('already')
  })

  it('reports a missing Train quest', async () => {
    await ensureSetup()
    const train = (await db.quests.toArray()).find((q) => q.title === 'Train')!
    await db.quests.update(train.id, { deleted: 1 })
    const id = await startSession(starterById('starter-fb-a'), trackingOf)
    expect(await logAndFinish(id, 100, 5)).toBe('missing')
  })

  it('adds a set copying the last one, and swaps a movement keeping its targets', async () => {
    const id = await startSession(starterById('starter-ppl-push'), trackingOf)
    const s = (await getSession(id))!
    const ex = s.exercises[3]! // A1 lateral raise
    const withSet = addSet(patchSet(s, ex.key, ex.sets[2]!.key, { kg: 10, reps: 15 }), ex.key)
    expect(withSet.exercises[3]!.sets.at(-1)).toMatchObject({ kg: 10, done: false })
    expect(withSet.exercises[3]!.sets.at(-1)!.reps).toBeUndefined()

    const swapped = swapExercise(withSet, ex.key, newExercise('Cable_Seated_Lateral_Raise', 'weight_reps', []))
    expect(swapped.exercises[3]).toMatchObject({ key: ex.key, movementId: 'Cable_Seated_Lateral_Raise', group: 'a', target: ex.target })
    expect(swapped.exercises[3]!.sets).toHaveLength(4)
  })
})
