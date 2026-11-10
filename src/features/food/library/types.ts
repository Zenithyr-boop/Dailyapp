import type { FoodGroup } from './foodList'

/**
 * One food in `foods.json` (compact, written by `npm run import:foods`).
 * `n` = kcal, protein g, carbs g, fat g per 100 g; `s` = [label, grams] servings.
 */
export interface UsdaJsonEntry {
  id: number
  name: string
  group: FoodGroup
  n: [kcal: number, proteinG: number, carbsG: number, fatG: number]
  s: [label: string, grams: number][]
}
