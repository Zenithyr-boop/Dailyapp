/**
 * The bundled USDA whole-food list. `foods.json` is loaded on demand (its own
 * chunk, precached by the service worker), so it costs nothing until the user
 * adds food and works offline.
 */
import type { Food } from '../nutrition'
import type { UsdaJsonEntry } from './types'

export const USDA_PREFIX = 'usda-'

export function toFood(e: UsdaJsonEntry): Food {
  const [kcal, proteinG, carbsG, fatG] = e.n
  return {
    id: `${USDA_PREFIX}${e.id}`,
    source: 'usda',
    name: e.name,
    group: e.group,
    per100: { kcal, proteinG, carbsG, fatG },
    servings: e.s.map(([label, grams]) => ({ label, grams })),
  }
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
