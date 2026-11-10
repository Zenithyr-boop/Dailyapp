/**
 * The user's own movements (local Dexie, synced to `users/{uid}/movements`).
 * Deleting leaves a tombstone so the deletion reaches other devices.
 */
import { db, type CustomMovement } from '../../../lib/db'
import { TRACKING_TYPES, type Movement } from './types'

export type CustomMovementFields = Pick<
  CustomMovement,
  'name' | 'primaryMuscles' | 'secondaryMuscles' | 'equipment' | 'category' | 'tracking' | 'instructions'
>

export const CUSTOM_PREFIX = 'custom-'
export const NAME_MAX = 60

/** Clean up user input: trimmed name, no empty lines, valid tracking type, no muscle listed twice. */
export function normalizeCustom(fields: CustomMovementFields): CustomMovementFields {
  const primary = [...new Set(fields.primaryMuscles)]
  return {
    name: fields.name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) || 'Untitled movement',
    primaryMuscles: primary,
    secondaryMuscles: [...new Set(fields.secondaryMuscles)].filter((m) => !primary.includes(m)),
    equipment: fields.equipment || 'none',
    category: fields.category || 'strength',
    tracking: TRACKING_TYPES.includes(fields.tracking) ? fields.tracking : 'weight_reps',
    instructions: fields.instructions.map((s) => s.trim()).filter(Boolean),
  }
}

export function customToMovement(c: CustomMovement): Movement {
  return {
    id: c.id,
    name: c.name,
    primaryMuscles: c.primaryMuscles,
    secondaryMuscles: c.secondaryMuscles,
    equipment: c.equipment,
    category: c.category,
    instructions: c.instructions,
    images: 0,
    tracking: c.tracking,
    source: 'custom',
  }
}

export async function listCustomMovements(): Promise<CustomMovement[]> {
  return (await db.movements.toArray()).filter((m) => !m.deleted)
}

export async function getCustomMovement(id: string): Promise<CustomMovement | undefined> {
  const m = await db.movements.get(id)
  return m && !m.deleted ? m : undefined
}

export async function createCustomMovement(fields: CustomMovementFields): Promise<string> {
  const id = CUSTOM_PREFIX + crypto.randomUUID()
  await db.movements.add({ ...normalizeCustom(fields), id, updatedAt: Date.now() })
  return id
}

export async function updateCustomMovement(id: string, fields: CustomMovementFields): Promise<void> {
  await db.movements.update(id, normalizeCustom(fields))
}

export async function deleteCustomMovement(id: string): Promise<void> {
  await db.movements.update(id, { deleted: 1 })
}
