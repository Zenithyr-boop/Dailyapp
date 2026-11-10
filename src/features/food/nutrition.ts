/**
 * Food maths: portions, totals and meal names. Pure functions, unit-tested in
 * `nutrition.test.ts`. Values are per 100 g; amounts are always stored in grams.
 */
import type { FoodSnapshot, MealSlot, Nutrient, Per100, Portion, Profile, Serving } from '../../lib/db'

export type FoodSource = 'usda' | 'off' | 'custom'

/** A food from any source, ready to log. */
export interface Food extends FoodSnapshot {
  source: FoodSource
  /** USDA list group (bundled foods only). */
  group?: string
  /** Custom foods that complete an Open Food Facts product: its barcode. */
  basedOn?: string
}

export const NUTRIENTS: readonly Nutrient[] = ['kcal', 'proteinG', 'carbsG', 'fatG']

export const NUTRIENT_LABELS: Record<Nutrient, string> = {
  kcal: 'Calories',
  proteinG: 'Protein',
  carbsG: 'Carbs',
  fatG: 'Fat',
}

export interface Totals {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export const ZERO: Totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks']

const DEFAULT_MEAL_NAMES: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

export const MEAL_NAME_MAX = 24

export function mealName(slot: MealSlot, profile?: Pick<Profile, 'mealNames'>): string {
  return profile?.mealNames?.[slot]?.trim() || DEFAULT_MEAL_NAMES[slot]
}

export function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === 'string' && (MEAL_SLOTS as readonly string[]).includes(value)
}

/** The meal that fits the time of day, for "Add food" without a meal. */
export function mealForTime(date: Date = new Date()): MealSlot {
  const h = date.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snacks'
}

/** Rounding used everywhere: whole kcal, protein/carbs/fat to 0.1 g. */
export function roundTotals(t: Totals): Totals {
  return {
    kcal: Math.round(t.kcal),
    proteinG: Math.round(t.proteinG * 10) / 10,
    carbsG: Math.round(t.carbsG * 10) / 10,
    fatG: Math.round(t.fatG * 10) / 10,
  }
}

/** Totals for an amount of a food. */
export function macrosFor(per100: Per100, grams: number): Totals {
  const f = Math.max(0, grams) / 100
  return roundTotals({ kcal: per100.kcal * f, proteinG: per100.proteinG * f, carbsG: per100.carbsG * f, fatG: per100.fatG * f })
}

export function sumTotals(items: readonly Totals[]): Totals {
  const sum = { ...ZERO }
  for (const t of items) {
    sum.kcal += t.kcal || 0
    sum.proteinG += t.proteinG || 0
    sum.carbsG += t.carbsG || 0
    sum.fatG += t.fatG || 0
  }
  return roundTotals(sum)
}

/** kcal from macros (4/4/9), used to check quick add numbers. */
export function kcalFromMacros(t: Pick<Totals, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return Math.round(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9)
}

/** How much was eaten: grams, or a number of servings. */
export type Amount = { grams: number } | { servings: number; serving: Serving }

export function amountGrams(a: Amount): number {
  return 'grams' in a ? a.grams : a.servings * a.serving.grams
}

/** A food + amount → the portion stored in the log (or a saved meal). */
export function portionOf(food: FoodSnapshot, amount: Amount): Portion {
  const grams = Math.round(amountGrams(amount) * 10) / 10
  const p: Portion = {
    name: food.name,
    foodId: food.id,
    grams,
    per100: { ...food.per100 },
    ...macrosFor(food.per100, grams),
  }
  if (food.brand) p.brand = food.brand
  if (food.barcode) p.barcode = food.barcode
  if (food.missing?.length) p.missing = [...food.missing]
  if ('servings' in amount) {
    p.servings = amount.servings
    p.serving = { ...amount.serving }
  }
  return p
}

/** The same portion with a new amount (editing a log entry). Quick add entries keep their totals. */
export function withAmount(portion: Portion, amount: Amount): Portion {
  if (!portion.per100) return portion
  const grams = Math.round(amountGrams(amount) * 10) / 10
  const next: Portion = { ...portion, grams, ...macrosFor(portion.per100, grams) }
  delete next.servings
  delete next.serving
  if ('servings' in amount) {
    next.servings = amount.servings
    next.serving = { ...amount.serving }
  }
  return next
}

/** The amount a portion was logged with (servings when it was logged that way). */
export function amountOf(portion: Portion): Amount {
  if (portion.servings !== undefined && portion.serving) return { servings: portion.servings, serving: portion.serving }
  return { grams: portion.grams ?? 100 }
}

/** The food a portion came from, rebuilt from its copy (to log it again). */
export function foodFromPortion(p: Portion): Food | undefined {
  if (!p.foodId || !p.per100) return undefined
  const source: FoodSource = p.foodId.startsWith('usda-') ? 'usda' : p.foodId.startsWith('off-') ? 'off' : 'custom'
  const food: Food = { id: p.foodId, source, name: p.name, per100: p.per100, servings: p.serving ? [p.serving] : [] }
  if (p.brand) food.brand = p.brand
  if (p.barcode) food.barcode = p.barcode
  if (p.missing?.length) food.missing = p.missing
  return food
}

/** Strip a Food down to what favourites and the cache keep. */
export function snapshotOf(food: FoodSnapshot): FoodSnapshot {
  const s: FoodSnapshot = { id: food.id, name: food.name, per100: { ...food.per100 }, servings: food.servings.map((x) => ({ ...x })) }
  if (food.brand) s.brand = food.brand
  if (food.barcode) s.barcode = food.barcode
  if (food.missing?.length) s.missing = [...food.missing]
  if (food.kcalFromKj) s.kcalFromKj = true
  return s
}

// ---- Units ---------------------------------------------------------------------

export const G_PER_OZ = 28.349523125

export const gToOz = (g: number) => g / G_PER_OZ
export const ozToG = (oz: number) => oz * G_PER_OZ

/** "150 g" / "5.3 oz". */
export function formatGrams(grams: number, unit: 'g' | 'oz' = 'g'): string {
  if (unit === 'oz') return `${Math.round(gToOz(grams) * 10) / 10} oz`
  return `${Math.round(grams * 10) / 10} g`
}

/** How a portion reads in a list: "2 × 1 large (100 g)", "150 g". */
export function describeAmount(p: Portion, unit: 'g' | 'oz' = 'g'): string {
  if (p.grams === undefined) return 'Quick add'
  if (p.servings !== undefined && p.serving) {
    const count = Math.round(p.servings * 100) / 100
    return `${count} × ${p.serving.label} (${formatGrams(p.grams, unit)})`
  }
  return formatGrams(p.grams, unit)
}

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const fmt1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

export function formatKcal(kcal: number): string {
  return fmt.format(kcal)
}

export function formatG(g: number): string {
  return fmt1.format(g)
}

/** Nutrients missing from a food, as words: "fat and carbs". */
export function missingText(missing: readonly Nutrient[]): string {
  const words = missing.map((n) => (n === 'kcal' ? 'calories' : NUTRIENT_LABELS[n].toLowerCase()))
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}
