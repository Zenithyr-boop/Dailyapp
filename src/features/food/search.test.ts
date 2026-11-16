import { describe, expect, it } from 'vitest'
import foods from './library/foods.json'
import { isPick, toFood } from './library/catalog'
import type { UsdaJsonEntry } from './library/types'
import type { Food } from './nutrition'
import { BOOST, indexFood, searchFoods } from './search'

const usda = (foods as UsdaJsonEntry[]).map(toFood)
// Like the app: the coach's picks get a nudge.
const index = usda.map((f) => indexFood(f, BOOST.usda + (isPick(f.id) ? BOOST.pick : 0)))
const names = (q: string, idx = index) => searchFoods(idx, q).map((f) => f.name)

describe('searchFoods', () => {
  it('finds exact names first', () => {
    expect(names('banana')[0]).toBe('Banana')
    expect(names('apple')[0]).toBe('Apple')
  })

  it('handles partial words, word order and typos', () => {
    expect(names('chick brea')).toContain('Chicken breast, raw')
    expect(names('breast chicken')).toContain('Chicken breast, cooked')
    expect(names('brocoli')[0]).toMatch(/^Broccoli/)
    expect(names('yougurt greek')[0]).toMatch(/^Greek yogurt/)
  })

  it('knows other names for foods', () => {
    expect(names('courgette')[0]).toBe('Zucchini')
    expect(names('porridge').slice(0, 3)).toContain('Oatmeal, cooked with water')
    expect(names('prawns')[0]).toMatch(/^Shrimp/)
    expect(names('pb')[0]).toMatch(/^Peanut butter/)
    expect(names('beef mince')[0]).toMatch(/^Ground beef/)
  })

  it('finds everyday dishes by the words people use', () => {
    expect(names('chicken and rice')[0]).toBe('Chicken and rice')
    expect(names('spaghetti bolognese')[0]).toBe('Spaghetti with meat sauce')
    expect(names('chilli')[0]).toMatch(/^Chili/)
    expect(names('stir fry').length).toBeGreaterThan(3)
    expect(names('chicken breast cooked')[0]).toBe('Chicken breast, cooked')
  })

  it('puts everyday staples first', () => {
    expect(names('rice').slice(0, 3)).toEqual(expect.arrayContaining(['White rice, cooked', 'Brown rice, cooked']))
    expect(names('oats').slice(0, 3)).toContain('Oats, rolled, dry')
    expect(names('burger').slice(0, 3)).toEqual(expect.arrayContaining(['Hamburger', 'Cheeseburger']))
    expect(names('egg').slice(0, 4)).toContain('Egg, hard-boiled')
  })

  it('returns nothing for an empty query or no match', () => {
    expect(names('  ')).toEqual([])
    expect(names('zzzzqqq')).toEqual([])
  })

  it('ranks the user’s own foods, then whole foods and dishes, then packaged products', () => {
    const mine: Food = { id: 'custom-1', source: 'custom', name: 'Banana bread', per100: { kcal: 300, proteinG: 5, carbsG: 50, fatG: 9 }, servings: [] }
    const packaged: Food = { id: 'off-123', source: 'off', name: 'Banana', brand: 'Brand', per100: { kcal: 90, proteinG: 1, carbsG: 23, fatG: 0 }, servings: [] }
    const idx = [indexFood(mine, BOOST.custom), ...index, indexFood(packaged, BOOST.off)]
    const ids = searchFoods(idx, 'banana').map((f) => f.id)
    expect(ids[0]).toBe('custom-1')
    expect(ids[1]).toBe('usda-173944')
    expect(ids.at(-1)).toBe('off-123')
  })

  it('lists a food once even when it is in two sources', () => {
    const fav = usda.find((f) => f.name === 'Banana')!
    const idx = [indexFood(fav, BOOST.favorite), ...index]
    expect(names('banana', idx).filter((n) => n === 'Banana')).toHaveLength(1)
  })
})
