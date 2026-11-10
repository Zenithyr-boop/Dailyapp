import { db } from '../../../lib/db'
import { starterById } from './starters'
import {
  deleteWorkout,
  duplicateWorkout,
  getWorkout,
  listStoredWorkouts,
  normalizeWorkout,
  restoreStarters,
  saveWorkout,
  workoutLists,
} from './workoutsRepo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const lists = async () => workoutLists(await listStoredWorkouts())

describe('workouts repo', () => {
  it('shows the bundled starters without storing them', async () => {
    const l = await lists()
    expect(l.yours).toEqual([])
    expect(l.programs.map((p) => p.program.name)).toEqual(['Push / Pull / Legs', 'Upper / Lower', 'Full Body, 3 days'])
    expect(l.programs.every((p) => p.rows.every((r) => !r.edited))).toBe(true)
    expect(await db.workouts.count()).toBe(0)
  })

  it('stores a starter under its fixed id only once it changes', async () => {
    const push = (await getWorkout('starter-ppl-push'))!
    await saveWorkout(push)
    expect(await db.workouts.count()).toBe(0)

    await saveWorkout({ ...push, name: 'Push day' })
    expect((await db.workouts.get('starter-ppl-push'))?.name).toBe('Push day')
    const row = (await lists()).programs[0]!.rows[0]!
    expect(row).toMatchObject({ edited: true, workout: { name: 'Push day' } })
  })

  it('creates, duplicates and deletes the user’s workouts', async () => {
    const id = await saveWorkout({ id: '', name: 'Arms', items: [], updatedAt: 0 })
    const copyId = (await duplicateWorkout(id))!
    expect((await lists()).yours.map((w) => w.name).sort()).toEqual(['Arms', 'Arms (copy)'])

    await deleteWorkout(id)
    expect(await getWorkout(id)).toBeUndefined()
    expect((await db.workouts.get(id))?.deleted).toBe(1) // tombstone for sync
    expect((await lists()).yours.map((w) => w.id)).toEqual([copyId])
  })

  it('duplicates a starter as a workout of the user’s', async () => {
    const id = (await duplicateWorkout('starter-fb-a'))!
    expect(id).not.toMatch(/^starter-/)
    expect((await getWorkout(id))?.items).toEqual(starterById('starter-fb-a')!.items)
    expect((await lists()).yours.map((w) => w.name)).toEqual(['Full Body A (copy)'])
  })

  it('deletes and restores starters', async () => {
    await deleteWorkout('starter-ul-lower')
    let l = await lists()
    expect(l.deletedStarters).toBe(1)
    expect(l.programs[1]!.rows.map((r) => r.workout.name)).toEqual(['Upper'])
    expect(await getWorkout('starter-ul-lower')).toBeUndefined()

    await restoreStarters()
    l = await lists()
    expect(l.deletedStarters).toBe(0)
    expect(l.programs[1]!.rows).toEqual([
      expect.objectContaining({ edited: false }),
      expect.objectContaining({ edited: false, workout: expect.objectContaining({ name: 'Lower' }) }),
    ])
  })

  it('cleans a workout before saving', () => {
    const out = normalizeWorkout(
      {
        name: '  ',
        note: ' ',
        items: [
          { key: 'a', movementId: 'Plank', sets: 3, repsMin: 8, repsMax: 12, restSec: 60, group: 'x' },
          { key: 'b', movementId: 'gone', sets: 2, seconds: 40, restSec: 30 },
        ],
      },
      (id) => (id === 'Plank' ? 'time' : undefined),
    )
    expect(out.name).toBe('Untitled workout')
    expect(out.note).toBeUndefined()
    expect(out.items[0]).toEqual({ key: 'a', movementId: 'Plank', sets: 3, seconds: 30, restSec: 60 }) // lone group dropped
    expect(out.items[1]).toMatchObject({ seconds: 40 }) // unknown movement keeps its target
  })
})
