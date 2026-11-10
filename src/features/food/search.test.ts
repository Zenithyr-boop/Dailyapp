import { describe, expect, it } from 'vitest'
import foods from './library/foods.json'
import { toFood } from './library/catalog'
import type { UsdaJsonEntry } from './library/types'
import type { Food } from './nutrition'
import { BOOST, indexFood, searchFoods } from './search'

const usda = (foods as UsdaJsonEntry[]).map(toFood)
const index = usda.map((f) => indexFood(f))
const names = (q: string, idx = index) => searchFoods(idx, q).map((f) => f.name)

describe('searchFoods', () => {
  it('finds exact names first', () => {
    expect(names('banana')[0]).toBe('Banana')
    expect(names('apple')[0]).toBe('Apple')
  })

  it('handles partial words, word order and typos', () => {
    expect(names('chick brea')).toContain('Chicken breast, raw')
    expect(names('breast chicken')).toContain('Chicken breast, roasted')
    expect(names('brocoli')[0]).toMatch(/^Broccoli/)
    expect(names('yougurt greek')[0]).toMatch(/^Greek yogurt/)
  })

  it('knows other names for foods', () => {
    expect(names('courgette')[0]).toBe('Zucchini')
    expect(names('porridge')).toContain('Oatmeal, cooked with water')
    expect(names('prawns')[0]).toMatch(/^Shrimp/)
    expect(names('pb')[0]).toMatch(/^Peanut butter/)
    expect(names('beef mince')[0]).toMatch(/^Ground beef/)
  })

  it('returns nothing for an empty query or no match', () => {
    expect(names('  ')).toEqual([])
    expect(names('zzzzqqq')).toEqual([])
  })

  it('puts the user’s own foods first when they match as well', () => {
    const mine: Food = { id: 'custom-1', source: 'custom', name: 'Banana bread', per100: { kcal: 300, proteinG: 5, carbsG: 50, fatG: 9 }, servings: [] }
    const idx = [indexFood(mine, BOOST.custom), ...index]
    expect(names('banana', idx).slice(0, 2)).toEqual(['Banana', 'Banana bread'])
    expect(names('banana bread', idx)[0]).toBe('Banana bread')
  })

  it('lists a food once even when it is in two sources', () => {
    const fav = usda.find((f) => f.name === 'Banana')!
    const idx = [indexFood(fav, BOOST.favorite), ...index]
    expect(names('banana', idx).filter((n) => n === 'Banana')).toHaveLength(1)
  })
})
