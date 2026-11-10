import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { copyDay, copyMeal, deleteEntry, entriesForDay, logPortion, recentFoods, updateEntry } from './foodLogRepo'
import {
  createCustomFood,
  createSavedMeal,
  customForBarcode,
  getFood,
  listFavorites,
  logSavedMeal,
  normalizeCustomFood,
  setFavorite,
  setMealName,
} from './foodsRepo'
import { portionOf, type Food } from './nutrition'

const banana: Food = {
  id: 'usda-173944',
  source: 'usda',
  name: 'Banana',
  per100: { kcal: 89, proteinG: 1.09, carbsG: 22.8, fatG: 0.33 },
  servings: [{ label: '1 medium', grams: 118 }],
}
const eggs: Food = { ...banana, id: 'usda-171287', name: 'Egg, whole, raw', per100: { kcal: 143, proteinG: 12.6, carbsG: 0.72, fatG: 9.51 } }

beforeEach(async () => {
  await Promise.all([db.food.clear(), db.foods.clear(), db.favorites.clear(), db.savedMeals.clear(), db.profile.clear(), db.quests.clear()])
})

describe('food log', () => {
  it('logs, edits, moves and deletes entries (as tombstones, flagged for sync)', async () => {
    const id = await logPortion('2026-11-10', 'breakfast', portionOf(banana, { grams: 100 }))
    let [entry] = await entriesForDay('2026-11-10')
    expect(entry).toMatchObject({ id, meal: 'breakfast', kcal: 89, dirty: 1 })

    await updateEntry(id, portionOf(banana, { servings: 2, serving: banana.servings[0]! }), 'snacks')
    ;[entry] = await entriesForDay('2026-11-10')
    expect(entry).toMatchObject({ meal: 'snacks', grams: 236, servings: 2, kcal: 210 })

    await deleteEntry(id)
    expect(await entriesForDay('2026-11-10')).toEqual([])
    expect((await db.food.get(id))?.deleted).toBe(1)
  })

  it('copies a meal and a whole day', async () => {
    await logPortion('2026-11-09', 'breakfast', portionOf(banana, { grams: 100 }))
    await logPortion('2026-11-09', 'breakfast', portionOf(eggs, { grams: 100 }))
    await logPortion('2026-11-09', 'dinner', portionOf(eggs, { grams: 50 }))

    expect(await copyMeal('2026-11-09', 'breakfast', '2026-11-10')).toBe(2)
    let today = await entriesForDay('2026-11-10')
    expect(today.map((e) => [e.meal, e.name])).toEqual([
      ['breakfast', 'Banana'],
      ['breakfast', 'Egg, whole, raw'],
    ])

    expect(await copyDay('2026-11-09', '2026-11-11')).toBe(3)
    today = await entriesForDay('2026-11-11')
    expect(today.map((e) => e.meal)).toEqual(['breakfast', 'breakfast', 'dinner'])
    expect(new Set(today.map((e) => e.id)).size).toBe(3)
    // The source day is untouched.
    expect(await entriesForDay('2026-11-09')).toHaveLength(3)
  })

  it('lists recent foods once each, newest first, without quick adds', async () => {
    await logPortion('2026-11-09', 'lunch', portionOf(banana, { grams: 100 }))
    await logPortion('2026-11-09', 'lunch', portionOf(eggs, { grams: 100 }))
    await logPortion('2026-11-10', 'lunch', portionOf(banana, { grams: 150 }))
    await logPortion('2026-11-10', 'lunch', { name: 'Quick add', kcal: 300, proteinG: 0, carbsG: 0, fatG: 0 })
    const recent = await recentFoods()
    expect(recent.map((r) => r.food.name)).toEqual(['Banana', 'Egg, whole, raw'])
    expect(recent[0]!.last.grams).toBe(150)
  })
})

describe('custom foods', () => {
  it('cleans input', () => {
    const f = normalizeCustomFood({
      name: '  My   shake ',
      brand: ' ',
      barcode: '1234 5678',
      per100: { kcal: 2000, proteinG: -1, carbsG: 10.555, fatG: Number.NaN },
      servings: [
        { label: ' 1 scoop ', grams: 30 },
        { label: '', grams: 10 },
        { label: 'bad', grams: 0 },
      ],
    })
    expect(f).toEqual({
      name: 'My shake',
      barcode: '12345678',
      per100: { kcal: 950, proteinG: 0, carbsG: 10.56, fatG: 0 },
      servings: [{ label: '1 scoop', grams: 30 }],
    })
  })

  it('finds the user’s own copy of a product by barcode', async () => {
    const id = await createCustomFood({ name: 'Bar (fixed)', basedOn: '5000000000001', per100: banana.per100, servings: [] })
    expect(await customForBarcode('5000000000001')).toMatchObject({ id, source: 'custom', basedOn: '5000000000001' })
    expect(await getFood(id)).toMatchObject({ name: 'Bar (fixed)' })
    expect(await customForBarcode('5000000000009')).toBeUndefined()
  })
})

describe('favourites and saved meals', () => {
  it('stars and unstars foods, and finds a favourite’s copy when the source is gone', async () => {
    const product: Food = { ...banana, id: 'off-5000000000005', source: 'off', name: 'Packaged thing' }
    await setFavorite(product, true)
    expect((await listFavorites()).map((f) => f.id)).toEqual(['off-5000000000005'])
    expect(await getFood('off-5000000000005')).toMatchObject({ name: 'Packaged thing', source: 'off' })
    await setFavorite(product, false)
    expect(await listFavorites()).toEqual([])
    await setFavorite(product, true)
    expect(await listFavorites()).toHaveLength(1)
  })

  it('logs a saved meal in one go', async () => {
    const id = await createSavedMeal('  Usual breakfast ', [portionOf(banana, { grams: 118 }), portionOf(eggs, { grams: 100 })])
    expect((await db.savedMeals.get(id))?.name).toBe('Usual breakfast')
    expect(await logSavedMeal(id, '2026-11-10', 'breakfast')).toBe(2)
    expect((await entriesForDay('2026-11-10')).map((e) => e.name)).toEqual(['Banana', 'Egg, whole, raw'])
  })

  it('renames meals and resets an empty name', async () => {
    await setMealName('snacks', '  Pre-workout ')
    expect((await db.profile.get('me'))?.mealNames).toEqual({ snacks: 'Pre-workout' })
    await setMealName('snacks', '')
    expect((await db.profile.get('me'))?.mealNames).toEqual({})
  })
})
