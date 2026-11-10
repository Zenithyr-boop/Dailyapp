import { describe, expect, it } from 'vitest'
import foods from './foods.json'
import { FOOD_LIST, SERVING_OVERRIDES } from './foodList'
import type { UsdaJsonEntry } from './types'

const entries = foods as UsdaJsonEntry[]

describe('bundled food list', () => {
  it('has every food from foodList.ts (re-run `npm run import:foods` after editing it)', () => {
    expect(entries.map((e) => e.id)).toEqual(FOOD_LIST.map((f) => f.fdcId))
    expect(entries.map((e) => e.name)).toEqual(FOOD_LIST.map((f) => f.name))
  })

  it('has about 300 foods with unique ids and names', () => {
    expect(entries.length).toBeGreaterThanOrEqual(280)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
    expect(new Set(entries.map((e) => e.name.toLowerCase())).size).toBe(entries.length)
  })

  it('has sensible values per 100 g', () => {
    for (const e of entries) {
      const [kcal, p, c, f] = e.n
      expect(kcal, e.name).toBeGreaterThanOrEqual(0)
      expect(kcal, e.name).toBeLessThanOrEqual(950)
      expect(p + c + f, e.name).toBeLessThanOrEqual(101)
      // Calories roughly agree with the macros (catches swapped columns). USDA uses
      // food-specific factors, so high-fibre foods come in well under 4/4/9; alcohol adds energy.
      const fromMacros = p * 4 + c * 4 + f * 9
      if (!/beer|wine|spirits/i.test(e.name)) {
        expect(kcal, e.name).toBeLessThanOrEqual(fromMacros * 1.15 + 20)
        expect(kcal, e.name).toBeGreaterThanOrEqual(fromMacros * 0.5 - 5)
      }
    }
  })

  it('has valid serving sizes', () => {
    for (const e of entries) {
      for (const [label, grams] of e.s) {
        expect(label.length, e.name).toBeGreaterThan(0)
        expect(grams, `${e.name}: ${label}`).toBeGreaterThan(0)
      }
    }
  })

  it('only overrides servings of listed foods', () => {
    const ids = new Set(FOOD_LIST.map((f) => f.fdcId))
    for (const id of Object.keys(SERVING_OVERRIDES)) expect(ids.has(Number(id)), id).toBe(true)
  })
})
