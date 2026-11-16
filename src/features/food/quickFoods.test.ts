import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { describeLink, evaluateLink, type LinkData } from '../quests/links'
import { linkDataFor } from '../quests/autoQuests'
import { getEntry, logPortion, recentFoods, setEntryValues } from './foodLogRepo'
import { createQuickFood, createSimpleMeal, customToFood, getCustomFood, listSavedMeals, normalizeCustomFood } from './foodsRepo'
import { logMeal, logQuickText, undoLogged } from './logActions'
import { describeAmount, macroGaps, portionOf, sumTotals } from './nutrition'
import { quickPortion } from './quickLog'

const DAY = '2026-11-16'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('foods with just a name and calories', () => {
  it('keeps one serving without a weight, values per serving, macros missing', async () => {
    const id = await createQuickFood({ name: "Mom's lasagna", kcal: 650, servingLabel: '1 plate' })
    const food = customToFood((await getCustomFood(id))!)
    expect(food).toMatchObject({ per100: { kcal: 650, proteinG: 0 }, servings: [{ label: '1 plate', grams: 100, nominal: true }], missing: ['proteinG', 'carbsG', 'fatG'] })
    const p = portionOf(food, { servings: 2, serving: food.servings[0]! })
    expect(p).toMatchObject({ kcal: 1300, missing: ['proteinG', 'carbsG', 'fatG'] })
    expect(describeAmount(p)).toBe('2 × 1 plate')
  })

  it('allows big servings without a weight but keeps the per-100 g limits for weighed foods', () => {
    const big = normalizeCustomFood({ name: 'Feast', per100: { kcal: 2400, proteinG: 120, carbsG: 200, fatG: 90 }, servings: [{ label: '1 tray', grams: 100, nominal: true }] })
    expect(big.per100.kcal).toBe(2400)
    const weighed = normalizeCustomFood({ name: 'Bar', per100: { kcal: 2400, proteinG: 0, carbsG: 0, fatG: 0 }, servings: [{ label: '1 bar', grams: 45 }] })
    expect(weighed.per100.kcal).toBe(950)
  })
})

describe('quick log actions', () => {
  it('logs a line, and Undo removes the entry and the food it saved', async () => {
    const logged = await logQuickText(DAY, 'lunch', { name: 'Chicken and rice', kcal: 500 }, true)
    expect(logged).toMatchObject({ name: 'Chicken and rice', kcal: 500, noMacros: true, fromFood: false })
    expect(logged.createdFoodId).toMatch(/^custom-/)
    // A saved food shows up in recents.
    expect((await recentFoods())[0]?.food.name).toBe('Chicken and rice')
    await undoLogged(logged)
    expect((await getEntry(logged.entryIds[0]!))).toBeUndefined()
    expect(await getCustomFood(logged.createdFoodId!)).toBeUndefined()
  })

  it('adds macros to an entry later', async () => {
    const id = await logPortion(DAY, 'dinner', quickPortion({ name: 'Curry', kcal: 700 }))
    await setEntryValues(id, { kcal: 700, proteinG: 40 })
    expect(await getEntry(id)).toMatchObject({ proteinG: 40, carbsG: 0, missing: ['carbsG', 'fatG'] })
    await setEntryValues(id, { kcal: 720, proteinG: 40, carbsG: 80, fatG: 25 })
    const e = await getEntry(id)
    expect(e).toMatchObject({ kcal: 720, carbsG: 80, fatG: 25 })
    expect(e?.missing).toBeUndefined()
  })

  it('makes a meal from a name and total calories and logs it in one go', async () => {
    await createSimpleMeal('Usual breakfast', { kcal: 520 })
    const [meal] = await listSavedMeals()
    expect(sumTotals(meal!.items).kcal).toBe(520)
    const logged = await logMeal(DAY, 'breakfast', meal!.id)
    expect(logged).toMatchObject({ name: 'Usual breakfast', kcal: 520, noMacros: true })
    expect(logged!.entryIds).toHaveLength(1)
  })
})

describe('totals and quests with entries that have no macros', () => {
  it('counts the calories and the entries without macros', async () => {
    await logPortion(DAY, 'lunch', quickPortion({ name: 'Wrap', kcal: 450 }))
    await logPortion(DAY, 'lunch', quickPortion({ name: 'Shake', kcal: 200, proteinG: 40 }))
    const entries = (await db.food.toArray()).filter((e) => !e.deleted)
    expect(sumTotals(entries)).toMatchObject({ kcal: 650, proteinG: 40 })
    expect(macroGaps(entries)).toBe(2)
    expect(macroGaps(entries, 'proteinG')).toBe(1)

    const data = await linkDataFor(DAY, { kcal: 2000, proteinG: 150 })
    expect(data).toMatchObject({ kcal: 650, proteinG: 40, foodEntries: 2, proteinUnknown: 1 })
  })

  it('ticks protein on the known protein and says what it couldn’t count', () => {
    const d: LinkData = { kcal: 1800, proteinG: 120, foodEntries: 4, proteinUnknown: 2, workouts: 0, goals: { kcal: 2000, proteinG: 150 } }
    const link = { source: 'protein' } as const
    expect(evaluateLink(link, d).done).toBe(false)
    expect(describeLink(link, d, 'metric')).toBe('120 / 150 g protein · 2 entries without protein')
    expect(evaluateLink(link, { ...d, proteinG: 160 }).done).toBe(true)
    expect(describeLink(link, { ...d, proteinG: 160 }, 'metric')).toBe('160 / 150 g protein')
    // Calories count normally.
    expect(evaluateLink({ source: 'calories', target: 250 }, d).done).toBe(true)
  })
})
