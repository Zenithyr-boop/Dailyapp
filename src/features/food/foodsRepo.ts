/**
 * The user's food data besides the log:
 * - custom foods (Dexie `foods` → `users/{uid}/foods`), including completed
 *   copies of Open Food Facts products (`basedOn` = barcode);
 * - favourites (`favorites` → `users/{uid}/favorites`), keyed by food id;
 * - saved meals (`savedMeals` → `users/{uid}/savedMeals`);
 * - meal names (profile `mealNames`).
 * Deletes are tombstones so they reach other devices.
 */
import { db, type CustomFood, type FavoriteFood, type MealSlot, type Per100, type Portion, type SavedMeal, type Serving } from '../../lib/db'
import { ensureSetup } from '../quests/questsRepo'
import { logPortions, portionOfEntry } from './foodLogRepo'
import { getUsdaFood } from './library/catalog'
import { MEAL_NAME_MAX, portionOf, snapshotOf, type Food } from './nutrition'
import { cleanBarcode, fetchProduct, getCachedProduct, OFF_PREFIX } from './off'

export const CUSTOM_FOOD_PREFIX = 'custom-'
export const FOOD_NAME_MAX = 60
export const BRAND_MAX = 40
export const SERVING_LABEL_MAX = 40
export const MAX_SERVINGS = 6
export const MEAL_ITEMS_MAX = 40

/** Upper limits for values per 100 g (pure fat is ~900 kcal). */
export const PER100_MAX: Per100 = { kcal: 950, proteinG: 100, carbsG: 100, fatG: 100 }

export interface CustomFoodFields {
  name: string
  brand?: string
  barcode?: string
  per100: Per100
  servings: Serving[]
  basedOn?: string
}

const clamp = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v * 100) / 100)) : 0)

/** Clean user input: trimmed text, values in range, only complete servings. */
export function normalizeCustomFood(f: CustomFoodFields): CustomFoodFields {
  const out: CustomFoodFields = {
    name: f.name.trim().replace(/\s+/g, ' ').slice(0, FOOD_NAME_MAX) || 'Untitled food',
    per100: {
      kcal: clamp(f.per100.kcal, PER100_MAX.kcal),
      proteinG: clamp(f.per100.proteinG, PER100_MAX.proteinG),
      carbsG: clamp(f.per100.carbsG, PER100_MAX.carbsG),
      fatG: clamp(f.per100.fatG, PER100_MAX.fatG),
    },
    servings: f.servings
      .map((s) => ({ label: s.label.trim().replace(/\s+/g, ' ').slice(0, SERVING_LABEL_MAX), grams: Math.round(s.grams * 10) / 10 }))
      .filter((s) => s.label && s.grams > 0 && s.grams <= 5000)
      .slice(0, MAX_SERVINGS),
  }
  const brand = f.brand?.trim().replace(/\s+/g, ' ').slice(0, BRAND_MAX)
  if (brand) out.brand = brand
  const barcode = f.barcode ? cleanBarcode(f.barcode) : undefined
  if (barcode) out.barcode = barcode
  const basedOn = f.basedOn ? cleanBarcode(f.basedOn) : undefined
  if (basedOn) out.basedOn = basedOn
  return out
}

export function customToFood(c: CustomFood): Food {
  const food: Food = { id: c.id, source: 'custom', name: c.name, per100: c.per100, servings: c.servings ?? [] }
  if (c.brand) food.brand = c.brand
  if (c.barcode ?? c.basedOn) food.barcode = c.barcode ?? c.basedOn
  if (c.basedOn) food.basedOn = c.basedOn
  return food
}

export async function listCustomFoods(): Promise<CustomFood[]> {
  const rows = await db.foods.toArray()
  return rows.filter((f) => !f.deleted).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getCustomFood(id: string): Promise<CustomFood | undefined> {
  const f = await db.foods.get(id)
  return f && !f.deleted ? f : undefined
}

export async function createCustomFood(fields: CustomFoodFields): Promise<string> {
  const id = CUSTOM_FOOD_PREFIX + crypto.randomUUID()
  await db.foods.add({ ...normalizeCustomFood(fields), id, updatedAt: Date.now() })
  return id
}

export async function updateCustomFood(id: string, fields: CustomFoodFields): Promise<void> {
  const current = await db.foods.get(id)
  if (!current) return
  await db.foods.put({ ...normalizeCustomFood(fields), id, updatedAt: Date.now() })
}

/**
 * After the user completes a product's missing nutrition: log entries of that
 * product that were missing values now use their copy (same amounts, new totals).
 * Returns how many entries changed.
 */
export async function applyFixToEntries(barcode: string, fixedId: string): Promise<number> {
  const fixed = await getCustomFood(fixedId)
  if (!fixed) return 0
  const food = customToFood(fixed)
  const productId = `${OFF_PREFIX}${barcode}`
  const rows = await db.food.filter((e) => !e.deleted && e.foodId === productId && !!e.missing?.length).toArray()
  for (const e of rows) {
    const amount = e.servings !== undefined && e.serving ? { servings: e.servings, serving: e.serving } : { grams: e.grams ?? 100 }
    await db.food.put({
      ...portionOf(food, amount),
      id: e.id,
      date: e.date,
      meal: e.meal,
      loggedAt: e.loggedAt,
      updatedAt: Date.now(),
    })
  }
  return rows.length
}

export async function deleteCustomFood(id: string): Promise<void> {
  await db.foods.update(id, { deleted: 1 })
}

/** The user's own food for a barcode (their food with that barcode, or their completed copy of that product). */
export async function customForBarcode(barcode: string): Promise<Food | undefined> {
  const code = cleanBarcode(barcode)
  if (!code) return undefined
  const rows = [...(await db.foods.where('barcode').equals(code).toArray()), ...(await db.foods.where('basedOn').equals(code).toArray())]
  const mine = rows.filter((f) => !f.deleted).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return mine ? customToFood(mine) : undefined
}

/** Scan / typed barcode: the user's own copy first, then Open Food Facts (cached on the device). */
export async function foodForBarcode(barcode: string): Promise<Food | undefined> {
  return (await customForBarcode(barcode)) ?? (await fetchProduct(barcode))
}

/** Any food by id, from wherever it lives. Falls back to a favourite's copy. */
export async function getFood(id: string): Promise<Food | undefined> {
  let food: Food | undefined
  if (id.startsWith(CUSTOM_FOOD_PREFIX)) {
    const c = await getCustomFood(id)
    food = c && customToFood(c)
  } else if (id.startsWith(OFF_PREFIX)) {
    // The user's completed copy of this product wins over the original.
    food = (await customForBarcode(id.slice(OFF_PREFIX.length))) ?? (await getCachedProduct(id))
  } else {
    food = await getUsdaFood(id)
  }
  if (food) return food
  const fav = await db.favorites.get(id)
  if (fav && !fav.deleted) return { ...fav.food, source: id.startsWith(OFF_PREFIX) ? 'off' : id.startsWith(CUSTOM_FOOD_PREFIX) ? 'custom' : 'usda' }
  return undefined
}

// ---- Favourites ---------------------------------------------------------------

export async function listFavorites(): Promise<FavoriteFood[]> {
  const rows = await db.favorites.toArray()
  return rows.filter((f) => !f.deleted).sort((a, b) => b.addedAt - a.addedAt)
}

export async function isFavorite(id: string): Promise<boolean> {
  const f = await db.favorites.get(id)
  return !!f && !f.deleted
}

export async function setFavorite(food: Food, on: boolean): Promise<void> {
  if (on) {
    const now = Date.now()
    await db.favorites.put({ id: food.id, food: snapshotOf(food), addedAt: now, updatedAt: now })
  } else if (await db.favorites.get(food.id)) {
    await db.favorites.update(food.id, { deleted: 1 })
  }
}

// ---- Saved meals --------------------------------------------------------------

export async function listSavedMeals(): Promise<SavedMeal[]> {
  const rows = await db.savedMeals.toArray()
  return rows.filter((m) => !m.deleted).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getSavedMeal(id: string): Promise<SavedMeal | undefined> {
  const m = await db.savedMeals.get(id)
  return m && !m.deleted ? m : undefined
}

function cleanMealName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, FOOD_NAME_MAX) || 'My meal'
}

export async function createSavedMeal(name: string, items: readonly Portion[]): Promise<string> {
  const id = crypto.randomUUID()
  await db.savedMeals.add({ id, name: cleanMealName(name), items: items.slice(0, MEAL_ITEMS_MAX).map(portionOfEntry), updatedAt: Date.now() })
  return id
}

export async function updateSavedMeal(id: string, name: string, items: readonly Portion[]): Promise<void> {
  await db.savedMeals.update(id, { name: cleanMealName(name), items: items.slice(0, MEAL_ITEMS_MAX).map(portionOfEntry) })
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await db.savedMeals.update(id, { deleted: 1 })
}

export async function logSavedMeal(id: string, date: string, meal: MealSlot): Promise<number> {
  const saved = await getSavedMeal(id)
  return saved ? logPortions(date, meal, saved.items) : 0
}

// ---- Meal names ------------------------------------------------------------------

export async function setMealName(slot: MealSlot, name: string): Promise<void> {
  await ensureSetup()
  const profile = await db.profile.get('me')
  const mealNames = { ...profile?.mealNames }
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, MEAL_NAME_MAX)
  if (clean) mealNames[slot] = clean
  else delete mealNames[slot]
  await db.profile.update('me', { mealNames })
}
