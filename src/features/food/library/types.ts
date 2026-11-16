import type { FoodGroup } from './foodList'

/**
 * One food in `foods.json` (compact, written by `npm run import:foods`).
 * `n` = kcal, protein g, carbs g, fat g (and fibre g when USDA lists it) per 100 g;
 * `s` = [label, grams] household servings.
 */
export interface UsdaJsonEntry {
  id: number
  name: string
  group: FoodGroup
  n: [kcal: number, proteinG: number, carbsG: number, fatG: number, fiberG?: number]
  s: [label: string, grams: number][]
}
