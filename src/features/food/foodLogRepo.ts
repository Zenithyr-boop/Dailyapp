/**
 * The food log (Dexie `food`, synced to `users/{uid}/food`). Each entry keeps a
 * copy of the food's values, so copying a meal or a day never needs a lookup.
 * Deleting leaves a tombstone so the deletion reaches other devices.
 */
import { db, type FoodEntry, type MealSlot, type Portion } from '../../lib/db'
import { foodFromPortion, type Food } from './nutrition'

export const newEntryId = () => crypto.randomUUID()

/** The portion part of an entry (no id, date, meal or sync fields). */
export function portionOfEntry(e: Portion): Portion {
  const p: Portion = { name: e.name, kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG }
  if (e.brand) p.brand = e.brand
  if (e.foodId) p.foodId = e.foodId
  if (e.barcode) p.barcode = e.barcode
  if (e.grams !== undefined) p.grams = e.grams
  if (e.servings !== undefined && e.serving) {
    p.servings = e.servings
    p.serving = { ...e.serving }
  }
  if (e.per100) p.per100 = { ...e.per100 }
  if (e.missing?.length) p.missing = [...e.missing]
  return p
}

let lastStamp = 0

/** Log times that only go up, so entries logged in the same millisecond keep their order. */
function stamps(count: number): number[] {
  const start = Math.max(Date.now(), lastStamp + 1)
  lastStamp = start + count - 1
  return Array.from({ length: count }, (_, i) => start + i)
}

/** New entries for these portions, in order. */
export function entriesFor(portions: readonly Portion[], date: string, meal: MealSlot): FoodEntry[] {
  const times = stamps(portions.length)
  return portions.map((p, i) => ({
    ...portionOfEntry(p),
    id: newEntryId(),
    date,
    meal,
    loggedAt: times[i]!,
    updatedAt: Date.now(),
  }))
}

export async function logPortions(date: string, meal: MealSlot, portions: readonly Portion[]): Promise<number> {
  const entries = entriesFor(portions, date, meal)
  await db.food.bulkAdd(entries)
  return entries.length
}

export async function logPortion(date: string, meal: MealSlot, portion: Portion): Promise<string> {
  const [entry] = entriesFor([portion], date, meal)
  await db.food.add(entry!)
  return entry!.id
}

/** A day's entries in the order they were logged. */
export async function entriesForDay(date: string): Promise<FoodEntry[]> {
  const rows = await db.food.where('date').equals(date).toArray()
  return rows.filter((e) => !e.deleted).sort((a, b) => a.loggedAt - b.loggedAt)
}

export async function getEntry(id: string): Promise<FoodEntry | undefined> {
  const e = await db.food.get(id)
  return e && !e.deleted ? e : undefined
}

/** Replace an entry's amount (and totals) and/or move it to another meal. */
export async function updateEntry(id: string, portion: Portion, meal: MealSlot): Promise<void> {
  const current = await db.food.get(id)
  if (!current || current.deleted) return
  await db.food.put({ ...portionOfEntry(portion), id, date: current.date, meal, loggedAt: current.loggedAt, updatedAt: Date.now() })
}

export async function deleteEntry(id: string): Promise<void> {
  await db.food.update(id, { deleted: 1 })
}

/** Copy one meal from a day into another day (same meal unless `toMeal`). Returns how many were copied. */
export async function copyMeal(fromDate: string, meal: MealSlot, toDate: string, toMeal: MealSlot = meal): Promise<number> {
  const source = (await entriesForDay(fromDate)).filter((e) => e.meal === meal)
  return logPortions(toDate, toMeal, source)
}

/** Copy every meal of a day into another day. Returns how many entries were copied. */
export async function copyDay(fromDate: string, toDate: string): Promise<number> {
  const source = await entriesForDay(fromDate)
  const entries = source.map((e) => entriesFor([e], toDate, e.meal)[0]!)
  await db.food.bulkAdd(entries)
  return entries.length
}

export interface RecentFood {
  food: Food
  /** The last time it was logged, as a portion (to log the same amount again). */
  last: Portion
}

/**
 * Foods logged lately, newest first, each once (by food id, so quick adds
 * aren't included). Scans at most `scan` entries.
 */
export async function recentFoods(limit = 30, scan = 400): Promise<RecentFood[]> {
  const rows = await db.food.orderBy('loggedAt').reverse().limit(scan).toArray()
  return recentFromEntries(rows, limit)
}

export function recentFromEntries(rows: readonly FoodEntry[], limit = 30): RecentFood[] {
  const seen = new Set<string>()
  const out: RecentFood[] = []
  for (const e of rows) {
    if (e.deleted || !e.foodId || seen.has(e.foodId)) continue
    const food = foodFromPortion(e)
    if (!food) continue
    seen.add(e.foodId)
    out.push({ food, last: portionOfEntry(e) })
    if (out.length >= limit) break
  }
  return out
}
