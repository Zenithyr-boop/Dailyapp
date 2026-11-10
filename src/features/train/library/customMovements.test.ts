import { db } from '../../../lib/db'
import {
  createCustomMovement,
  deleteCustomMovement,
  getCustomMovement,
  listCustomMovements,
  normalizeCustom,
  updateCustomMovement,
  type CustomMovementFields,
} from './customMovements'

const fields: CustomMovementFields = {
  name: '  Landmine   Press ',
  primaryMuscles: ['shoulders', 'shoulders'],
  secondaryMuscles: ['triceps', 'shoulders'],
  equipment: 'barbell',
  category: 'strength',
  tracking: 'weight_reps',
  instructions: ['Hold the end of the bar at your shoulder.', '  ', 'Press up and forward.'],
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('custom movements', () => {
  it('cleans up input', () => {
    const n = normalizeCustom(fields)
    expect(n.name).toBe('Landmine Press')
    expect(n.primaryMuscles).toEqual(['shoulders'])
    expect(n.secondaryMuscles).toEqual(['triceps'])
    expect(n.instructions).toHaveLength(2)
    expect(normalizeCustom({ ...fields, name: ' ', tracking: 'nope' as never }).tracking).toBe('weight_reps')
  })

  it('creates a movement flagged for sync', async () => {
    const id = await createCustomMovement(fields)
    expect(id).toMatch(/^custom-/)
    const stored = await db.movements.get(id)
    expect(stored?.dirty).toBe(1)
    expect(stored?.updatedAt).toBeGreaterThan(0)
  })

  it('edits and deletes with a tombstone', async () => {
    const id = await createCustomMovement(fields)
    await updateCustomMovement(id, { ...fields, name: 'Half-kneeling landmine press', tracking: 'bodyweight_reps' })
    expect((await getCustomMovement(id))?.name).toBe('Half-kneeling landmine press')

    await deleteCustomMovement(id)
    expect(await listCustomMovements()).toEqual([])
    expect(await getCustomMovement(id)).toBeUndefined()
    expect((await db.movements.get(id))?.deleted).toBe(1)
  })
})
