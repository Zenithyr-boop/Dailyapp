import { describe, expect, it } from 'vitest'
import type { FoodSnapshot } from '../../lib/db'
import {
  amountOf,
  describeAmount,
  foodFromPortion,
  kcalFromMacros,
  macrosFor,
  mealForTime,
  mealName,
  missingText,
  portionOf,
  sumTotals,
  withAmount,
} from './nutrition'

const oats: FoodSnapshot = {
  id: 'usda-173904',
  name: 'Oats, rolled, dry',
  per100: { kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.52 },
  servings: [{ label: '½ cup', grams: 40 }],
}

describe('macrosFor', () => {
  it('scales values per 100 g and rounds (whole kcal, 0.1 g)', () => {
    expect(macrosFor(oats.per100, 80)).toEqual({ kcal: 303, proteinG: 10.6, carbsG: 54.2, fatG: 5.2 })
  })
  it('treats negative amounts as zero', () => {
    expect(macrosFor(oats.per100, -5).kcal).toBe(0)
  })
})

describe('portions', () => {
  it('logs by grams', () => {
    const p = portionOf(oats, { grams: 60 })
    expect(p).toMatchObject({ name: 'Oats, rolled, dry', foodId: 'usda-173904', grams: 60, kcal: 227 })
    expect(p.servings).toBeUndefined()
  })

  it('logs by servings', () => {
    const p = portionOf(oats, { servings: 1.5, serving: oats.servings[0]! })
    expect(p.grams).toBe(60)
    expect(p.servings).toBe(1.5)
    expect(p.serving).toEqual({ label: '½ cup', grams: 40 })
    expect(describeAmount(p)).toBe('1.5 × ½ cup (60 g)')
  })

  it('keeps missing nutrients and brand', () => {
    const p = portionOf({ ...oats, brand: 'Acme', missing: ['fatG'] }, { grams: 100 })
    expect(p.brand).toBe('Acme')
    expect(p.missing).toEqual(['fatG'])
  })

  it('changes the amount of a logged portion', () => {
    const p = portionOf(oats, { servings: 1, serving: oats.servings[0]! })
    const q = withAmount(p, { grams: 100 })
    expect(q).toMatchObject({ grams: 100, kcal: 379 })
    expect(q.servings).toBeUndefined()
    expect(amountOf(q)).toEqual({ grams: 100 })
    expect(amountOf(p)).toEqual({ servings: 1, serving: { label: '½ cup', grams: 40 } })
  })

  it('leaves quick adds alone', () => {
    const quick = { name: 'Quick add', kcal: 500, proteinG: 30, carbsG: 50, fatG: 20 }
    expect(withAmount(quick, { grams: 10 })).toBe(quick)
    expect(describeAmount(quick)).toBe('Quick add')
    expect(foodFromPortion(quick)).toBeUndefined()
  })

  it('rebuilds the food from a portion', () => {
    const food = foodFromPortion(portionOf({ ...oats, id: 'off-123' }, { grams: 50 }))
    expect(food).toMatchObject({ id: 'off-123', source: 'off', per100: oats.per100 })
  })

  it('shows ounces', () => {
    expect(describeAmount(portionOf(oats, { grams: 100 }), 'oz')).toBe('3.5 oz')
  })
})

describe('totals', () => {
  it('adds up entries', () => {
    expect(
      sumTotals([
        { kcal: 100.4, proteinG: 1.04, carbsG: 2, fatG: 3 },
        { kcal: 200.4, proteinG: 2.04, carbsG: 0, fatG: 0.05 },
      ]),
    ).toEqual({ kcal: 301, proteinG: 3.1, carbsG: 2, fatG: 3.1 })
  })

  it('works out kcal from macros', () => {
    expect(kcalFromMacros({ proteinG: 30, carbsG: 50, fatG: 10 })).toBe(410)
  })
})

describe('meals', () => {
  it('uses the user’s names, else the defaults', () => {
    expect(mealName('snacks')).toBe('Snacks')
    expect(mealName('snacks', { mealNames: { snacks: 'Pre-workout' } })).toBe('Pre-workout')
    expect(mealName('lunch', { mealNames: { lunch: '  ' } })).toBe('Lunch')
  })

  it('picks a meal by time of day', () => {
    expect(mealForTime(new Date(2026, 0, 1, 7))).toBe('breakfast')
    expect(mealForTime(new Date(2026, 0, 1, 12))).toBe('lunch')
    expect(mealForTime(new Date(2026, 0, 1, 19))).toBe('dinner')
    expect(mealForTime(new Date(2026, 0, 1, 22))).toBe('snacks')
  })

  it('lists missing nutrients in words', () => {
    expect(missingText(['fatG'])).toBe('fat')
    expect(missingText(['kcal', 'carbsG', 'fatG'])).toBe('calories, carbs and fat')
  })
})
