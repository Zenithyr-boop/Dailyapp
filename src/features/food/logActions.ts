/**
 * One-tap logging and its undo: quick log lines, search results, saved meals.
 * Every action returns what it logged, so the Food screens can offer Undo,
 * "Add macros" and "Adjust amount" right after.
 */
import type { MealSlot, Portion } from '../../lib/db'
import { addPortions, deleteEntry, logPortion } from './foodLogRepo'
import { createQuickFood, customToFood, deleteCustomFood, getCustomFood, getSavedMeal } from './foodsRepo'
import { defaultAmount, lacksMacros, portionOf, sumTotals } from './nutrition'
import { quickPortion, type QuickLogText } from './quickLog'

export interface Logged {
  date: string
  meal: MealSlot
  name: string
  kcal: number
  entryIds: string[]
  /** "Save for next time" made this food: Undo removes it too. */
  createdFoodId?: string
  /** One entry without (some) macros: offer "Add macros". */
  noMacros: boolean
  /** One entry logged from a food: offer "Adjust amount". */
  fromFood: boolean
}

function loggedOne(date: string, meal: MealSlot, entryId: string, portion: Portion, createdFoodId?: string): Logged {
  const out: Logged = {
    date,
    meal,
    name: portion.name,
    kcal: portion.kcal,
    entryIds: [entryId],
    noMacros: lacksMacros(portion),
    fromFood: portion.grams !== undefined && !portion.serving?.nominal,
  }
  if (createdFoodId) out.createdFoodId = createdFoodId
  return out
}

/** Log a quick log line. With `save`, it becomes a custom food first (shows up in recents and search). */
export async function logQuickText(date: string, meal: MealSlot, q: QuickLogText, save: boolean): Promise<Logged> {
  if (save && q.name) {
    const foodId = await createQuickFood(q)
    const custom = await getCustomFood(foodId)
    if (custom) {
      const food = customToFood(custom)
      const portion = portionOf(food, defaultAmount(food))
      return loggedOne(date, meal, await logPortion(date, meal, portion), portion, foodId)
    }
  }
  const portion = quickPortion(q)
  return loggedOne(date, meal, await logPortion(date, meal, portion), portion)
}

/** Log one portion (a tapped search result). */
export async function logOne(date: string, meal: MealSlot, portion: Portion): Promise<Logged> {
  return loggedOne(date, meal, await logPortion(date, meal, portion), portion)
}

/** Log every food in a saved meal. */
export async function logMeal(date: string, meal: MealSlot, mealId: string): Promise<Logged | undefined> {
  const saved = await getSavedMeal(mealId)
  if (!saved) return undefined
  const ids = await addPortions(date, meal, saved.items)
  const single = saved.items.length === 1 ? saved.items[0] : undefined
  return {
    date,
    meal,
    name: saved.name,
    kcal: sumTotals(saved.items).kcal,
    entryIds: ids,
    noMacros: !!single && lacksMacros(single),
    fromFood: !!single && single.grams !== undefined && !single.serving?.nominal,
  }
}

/** Undo: remove what was just logged (and the food "save for next time" made). */
export async function undoLogged(l: Logged): Promise<void> {
  for (const id of l.entryIds) await deleteEntry(id)
  if (l.createdFoodId) await deleteCustomFood(l.createdFoodId)
}
