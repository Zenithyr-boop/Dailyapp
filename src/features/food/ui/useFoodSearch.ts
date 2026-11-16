import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import type { Portion, SavedMeal } from '../../../lib/db'
import { recentFoods } from '../foodLogRepo'
import { customToFood, listCustomFoods, listFavorites, listSavedMeals } from '../foodsRepo'
import { DISH_GROUPS, isPick, loadUsdaFoods } from '../library/catalog'
import { defaultAmount, portionOf, sumTotals, type Food } from '../nutrition'
import { cachedProducts } from '../off'
import { BOOST, indexFood, searchFoods, type FoodIndexEntry } from '../search'

/** Where a result comes from, shown as a small label. */
export type ResultTier = 'recent' | 'custom' | 'favorite' | 'meal' | 'whole' | 'dish' | 'packaged'

export const TIER_LABEL: Record<ResultTier, string> = {
  recent: 'Recent',
  custom: 'Yours',
  favorite: 'Favourite',
  meal: 'Saved meal',
  whole: 'Whole food',
  dish: 'Dish',
  packaged: 'Packaged',
}

/** One search result, ready to log in one tap. */
export type FoodResult =
  | { kind: 'food'; key: string; food: Food; tier: ResultTier; portion: Portion }
  | { kind: 'meal'; key: string; meal: SavedMeal; tier: 'meal'; kcal: number }

const MEAL_PREFIX = 'meal:'

export function sourceFavorite(id: string): Food['source'] {
  return id.startsWith('off-') ? 'off' : id.startsWith('custom-') ? 'custom' : 'usda'
}

export function tierOf(food: Food): ResultTier {
  if (food.source === 'custom') return 'custom'
  if (food.source === 'off') return 'packaged'
  return food.group && DISH_GROUPS.has(food.group) ? 'dish' : 'whole'
}

/** A food's one-tap portion: its first serving (or 100 g). */
export function foodResult(food: Food, tier: ResultTier = tierOf(food), portion?: Portion): FoodResult {
  return { kind: 'food', key: food.id, food, tier, portion: portion ?? portionOf(food, defaultAmount(food)) }
}

/** The bundled USDA list, loaded once (when the Food tab opens). */
export function useUsdaFoods() {
  const [usda, setUsda] = useState<Food[]>()
  const [error, setError] = useState(false)
  useEffect(() => {
    loadUsdaFoods().then(setUsda, () => setError(true))
  }, [])
  return { usda, error }
}

/**
 * Search everything on the device: recents and the user's own foods/meals first,
 * then the bundled whole foods and dishes, then packaged products seen before.
 * Recent foods log the amount they were logged with last time.
 */
export function useFoodSearch(query: string, limit = 30) {
  const { usda, error } = useUsdaFoods()
  const recent = useLiveQuery(() => recentFoods(40), [])
  const mine = useLiveQuery(listCustomFoods, [])
  const favorites = useLiveQuery(listFavorites, [])
  const meals = useLiveQuery(listSavedMeals, [])
  const seen = useLiveQuery(cachedProducts, [])

  const { index, lastPortion, mealById } = useMemo(() => {
    const lastPortion = new Map((recent ?? []).map((r) => [r.food.id, r.last]))
    const mealById = new Map((meals ?? []).map((m) => [MEAL_PREFIX + m.id, m]))
    const mealFoods = (meals ?? []).map((m): Food => ({ id: MEAL_PREFIX + m.id, source: 'custom', name: m.name, per100: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, servings: [] }))
    // First copy of a food wins: list the user's own first.
    const index: FoodIndexEntry[] = [
      ...(recent ?? []).map((r) => indexFood(r.food, BOOST.recent)),
      ...(mine ?? []).map((c) => indexFood(customToFood(c), BOOST.custom)),
      ...(favorites ?? []).map((f) => indexFood({ ...f.food, source: sourceFavorite(f.id) }, BOOST.favorite)),
      ...mealFoods.map((f) => indexFood(f, BOOST.meal)),
      ...(usda ?? []).map((f) => indexFood(f, BOOST.usda + (isPick(f.id) ? BOOST.pick : 0))),
      ...(seen ?? []).map((f) => indexFood(f, BOOST.off)),
    ]
    return { index, lastPortion, mealById }
  }, [recent, mine, favorites, meals, usda, seen])

  const results = useMemo((): FoodResult[] => {
    const recentIds = new Set(lastPortion.keys())
    const favIds = new Set((favorites ?? []).map((f) => f.id))
    return searchFoods(index, query, limit).map((food) => {
      const meal = mealById.get(food.id)
      if (meal) return { kind: 'meal', key: food.id, meal, tier: 'meal', kcal: sumTotals(meal.items).kcal }
      if (recentIds.has(food.id)) return foodResult(food, 'recent', lastPortion.get(food.id))
      if (food.source !== 'custom' && favIds.has(food.id)) return foodResult(food, 'favorite')
      return foodResult(food)
    })
  }, [index, query, limit, lastPortion, mealById, favorites])

  return { results, ready: !!usda, error }
}
