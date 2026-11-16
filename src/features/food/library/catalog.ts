/**
 * The bundled USDA list (~1,800 whole foods and everyday dishes). `foods.json` is
 * loaded on demand (its own chunk, precached by the service worker) when the Food
 * tab opens, so it never slows the app's first load, and it works offline.
 */
import type { Food } from '../nutrition'
import { FOOD_PICKS } from './picks'
import type { UsdaJsonEntry } from './types'

export const USDA_PREFIX = 'usda-'

export function toFood(e: UsdaJsonEntry): Food {
  const [kcal, proteinG, carbsG, fatG, fiberG] = e.n
  return {
    id: `${USDA_PREFIX}${e.id}`,
    source: 'usda',
    name: e.name,
    group: e.group,
    per100: fiberG === undefined ? { kcal, proteinG, carbsG, fatG } : { kcal, proteinG, carbsG, fatG, fiberG },
    servings: e.s.map(([label, grams]) => ({ label, grams })),
  }
}

/** Groups that hold dishes (FNDDS) rather than single foods: labelled "Dish" in results. */
export const DISH_GROUPS: ReadonlySet<string> = new Set(['Meals & dishes', 'Sandwiches & burgers', 'Soups'])

/** One of the coach's everyday staples (ranked first among equal matches). */
export function isPick(id: string): boolean {
  return id.startsWith(USDA_PREFIX) && FOOD_PICKS.has(Number(id.slice(USDA_PREFIX.length)))
}

let cache: Promise<Food[]> | undefined

/** All bundled foods (loaded once per app session). */
export function loadUsdaFoods(): Promise<Food[]> {
  cache ??= import('./foods.json')
    .then((mod) => (mod.default as UsdaJsonEntry[]).map(toFood))
    .catch((error: unknown) => {
      cache = undefined
      throw error
    })
  return cache
}

export async function getUsdaFood(id: string): Promise<Food | undefined> {
  if (!id.startsWith(USDA_PREFIX)) return undefined
  return (await loadUsdaFoods()).find((f) => f.id === id)
}
