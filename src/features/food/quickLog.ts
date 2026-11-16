/**
 * Quick log: one line of text → a food log entry. Pure, unit-tested in `quickLog.test.ts`.
 *
 *   "chicken breast and rice - 500"   → Chicken breast and rice, 500 kcal
 *   "chicken and rice 500 cal"        → Chicken and rice, 500 kcal
 *   "lunch 500 cal 40p 50c 12f"       → Lunch, 500 kcal, P 40 · C 50 · F 12
 *
 * Only calories are needed; macros are picked up when they're there and never required.
 * Without a calorie number the text is just a search.
 */
import type { Nutrient, Portion } from '../../lib/db'
import { FOOD_NAME_MAX } from './foodsRepo'
import { kcalFromMacros, MACROS, roundTotals, type Macro } from './nutrition'

export interface QuickLogText {
  /** What's left of the text once the numbers are taken out ('' when it was only numbers). */
  name: string
  kcal: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export const QUICK_LOG_MAX_KCAL = 10000
const MACRO_MAX = 1000
/** A bare number at the end only counts as calories from this much up ("eggs 2" is not 2 kcal). */
const BARE_MIN_KCAL = 10
export const QUICK_LOG_DEFAULT_NAME = 'Quick log'

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
const WORDS: Record<Macro, string> = {
  proteinG: 'p|prot|protein',
  carbsG: 'c|carb|carbs|carbohydrates?',
  fatG: 'f|fat|fats',
}

const toNumber = (s: string) => Number(s.replace(',', '.'))

function take(text: string, re: RegExp): { text: string; value?: number } {
  const m = text.match(re)
  if (!m || m.index === undefined) return { text }
  const value = toNumber(m.slice(1).find((g) => g !== undefined && /\d/.test(g))!)
  return { text: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`, value }
}

/** Parse a quick log line. `undefined` when there's no calorie number (then it's a search). */
export function parseQuickLog(input: string): QuickLogText | undefined {
  let text = ` ${input.replace(/\s+/g, ' ').trim()} `
  const macros: Partial<Record<Macro, number>> = {}

  // "500 cal", "500kcal", "500 calories", or "kcal 500", "calories: 500".
  let kcal: number | undefined
  let r = take(text, new RegExp(String.raw`(?<=[\s,;/(])${NUM}\s*(?:k?cals?|kcal|calories|calorie)(?=[\s,;/)]|$)`, 'i'))
  if (r.value === undefined) r = take(text, new RegExp(String.raw`(?<=[\s,;/(])(?:k?cals?|calories)\s*:?\s*${NUM}(?=[\s,;/)]|$)`, 'i'))
  if (r.value !== undefined) {
    kcal = r.value
    text = r.text
  }

  for (const macro of MACROS) {
    const words = WORDS[macro]
    // "40p", "40 g protein", "40g carbs" — or "p40", "protein 40", "fat: 12g".
    const after = new RegExp(String.raw`(?<=[\s,;/(])${NUM}\s*g?\s*(?:${words})(?=[\s,;/)]|$)`, 'i')
    const before = new RegExp(String.raw`(?<=[\s,;/(])(?:${words.replace(/^p\||^c\||^f\|/, '')})\s*:?\s*${NUM}\s*g?(?=[\s,;/)]|$)|(?<=[\s,;/(])[${macro[0]}]${NUM}(?=[\s,;/)]|$)`, 'i')
    let m = take(text, after)
    if (m.value === undefined) m = take(text, before)
    if (m.value !== undefined && m.value <= MACRO_MAX) {
      macros[macro] = m.value
      text = m.text
    }
  }

  if (kcal === undefined) {
    // A number at the end: "chicken and rice 500", "chicken and rice - 500".
    const m = text.match(new RegExp(String.raw`(?:^|[\s\-–—:=,@])${NUM}\s*$`))
    if (m && m.index !== undefined && toNumber(m[1]!) >= BARE_MIN_KCAL) {
      kcal = toNumber(m[1]!)
      text = text.slice(0, m.index)
    }
  }

  const hasMacros = Object.keys(macros).length > 0
  if (kcal === undefined && hasMacros) {
    kcal = kcalFromMacros({ proteinG: macros.proteinG ?? 0, carbsG: macros.carbsG ?? 0, fatG: macros.fatG ?? 0 })
  }
  if (kcal === undefined || !(kcal > 0) || kcal > QUICK_LOG_MAX_KCAL) return undefined

  const name = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:=,;@/]+|[\s\-–—:=,;@/]+$/g, '')
    .replace(/\(\s*\)/g, '')
    .trim()
    .slice(0, FOOD_NAME_MAX)
  return { name: name.charAt(0).toUpperCase() + name.slice(1), kcal: Math.round(kcal), ...macros }
}

/** The macros the text didn't give (stored as `missing`, counted as 0). */
export function missingMacros(q: Pick<QuickLogText, Macro>): Nutrient[] {
  return MACROS.filter((m) => q[m] === undefined)
}

/** The log entry for a parsed line (no food: just the totals). */
export function quickPortion(q: QuickLogText): Portion {
  const totals = roundTotals({ kcal: q.kcal, proteinG: q.proteinG ?? 0, carbsG: q.carbsG ?? 0, fatG: q.fatG ?? 0 })
  const p: Portion = { name: q.name || QUICK_LOG_DEFAULT_NAME, ...totals }
  const missing = missingMacros(q)
  if (missing.length) p.missing = missing
  return p
}
