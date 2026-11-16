import { describe, expect, it } from 'vitest'
import foods from './foods.json'
import { FOOD_LIST, SERVING_OVERRIDES } from './foodList'
import type { UsdaJsonEntry } from './types'

const entries = foods as UsdaJsonEntry[]

/** Staples whose raw and cooked values differ a lot: the name must say which. */
const STATE = /\b(raw|dry|uncooked|cooked|roasted|grilled|baked|boiled|broiled|fried|pan-fried|stewed|steamed|sauteed|poached|scrambled|rotisserie|braised|smoked|canned|instant|made with|with skin|skinless)\b/i
const STAPLE = /^(chicken (breast|thigh|drumstick|wings?)|white rice|brown rice|rice, (white|brown)|pasta|whole-wheat pasta|spaghetti|quinoa|oats|oatmeal|lentils|ground (beef|turkey|chicken|pork|lamb)|salmon|cod|tilapia|shrimp|turkey breast|pork (chop|tenderloin)|sirloin|ribeye|flank)(,|$)/i

describe('bundled food list', () => {
  it('has every food from foodList.ts (re-run `npm run import:foods` after editing it)', () => {
    expect(entries.map((e) => e.id)).toEqual(FOOD_LIST.map((f) => f.fdcId))
    expect(entries.map((e) => e.name)).toEqual(FOOD_LIST.map((f) => f.name))
  })

  it('has 1,500–2,000 foods with unique ids and names', () => {
    expect(entries.length).toBeGreaterThanOrEqual(1500)
    expect(entries.length).toBeLessThanOrEqual(2000)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
    expect(new Set(entries.map((e) => e.name.toLowerCase())).size).toBe(entries.length)
  })

  it('has sensible values per 100 g', () => {
    for (const e of entries) {
      const [kcal, p, c, f, fiber] = e.n
      if (fiber !== undefined) expect(fiber, e.name).toBeLessThanOrEqual(c + 0.5)
      expect(kcal, e.name).toBeGreaterThanOrEqual(0)
      expect(kcal, e.name).toBeLessThanOrEqual(950)
      expect(p + c + f, e.name).toBeLessThanOrEqual(101)
      // Calories roughly agree with the macros (catches swapped columns). USDA uses
      // food-specific factors, so high-fibre foods come in well under 4/4/9; alcohol adds
      // energy the macros don't show (drinks skip the upper check).
      const fromMacros = p * 4 + c * 4 + f * 9
      if (e.group !== 'Drinks') expect(kcal, e.name).toBeLessThanOrEqual(fromMacros * 1.15 + 20)
      expect(kcal, e.name).toBeGreaterThanOrEqual(fromMacros * 0.5 - 5)
    }
  })

  it('says raw or cooked for meat, fish, rice, pasta, oats and lentils', () => {
    for (const e of entries) {
      if (STAPLE.test(e.name)) expect(e.name, 'name the state (raw, dry, cooked…)').toMatch(STATE)
    }
  })

  it('gives most foods a household serving', () => {
    const withServing = entries.filter((e) => e.s.length > 0).length
    expect(withServing / entries.length).toBeGreaterThan(0.9)
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
