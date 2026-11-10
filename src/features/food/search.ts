/**
 * Food search over everything on the device (bundled USDA foods, the user's
 * own foods, favourites and cached packaged products). Tolerates typos,
 * partial words and a few other names for foods (UK words, abbreviations).
 * Pure functions, unit-tested in `search.test.ts`.
 *
 * Ranking: best match first; the user's own foods and favourites get a nudge
 * so they come first when they match about as well.
 */
import { editDistance, normalize, stem } from '../train/library/search'
import type { Food } from './nutrition'

/** Other words a food can be found by. Matched against the food's name. */
const ALIASES: readonly [RegExp, string][] = [
  [/peanut butter/, 'pb'],
  [/orange juice/, 'oj'],
  [/yogurt/, 'yoghurt'],
  [/zucchini/, 'courgette'],
  [/eggplant/, 'aubergine'],
  [/bell pepper/, 'capsicum'],
  [/arugula/, 'rocket'],
  [/^ground /, 'mince minced'],
  [/oatmeal/, 'porridge'],
  [/oats/, 'porridge oatmeal'],
  [/shrimp/, 'prawn prawns'],
  [/potato chips/, 'crisps'],
  [/french fries/, 'chips fries'],
  [/cookies/, 'biscuits'],
  [/cola/, 'soda coke'],
  [/whey/, 'protein shake'],
  [/protein powder|protein isolate/, 'shake'],
  [/garbanzo|chickpea/, 'garbanzo chickpea'],
  [/cilantro/, 'coriander'],
  [/powdered sugar/, 'icing sugar'],
  [/sweet corn/, 'maize'],
  [/skim/, 'skimmed fat free'],
  [/whole milk/, 'full fat'],
  [/cottage cheese/, 'cottage'],
  [/hard-boiled/, 'boiled egg'],
  [/ketchup/, 'catsup tomato sauce'],
  [/eggs?\b/, 'egg'],
]

export interface FoodIndexEntry {
  food: Food
  /** Tier nudge: own foods and favourites first among similar matches. */
  boost: number
  name: string[]
  compact: string
  extra: string[]
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean).map(stem)
}

export function indexFood(food: Food, boost = 0): FoodIndexEntry {
  const lower = food.name.toLowerCase()
  const aliasText = ALIASES.filter(([re]) => re.test(lower))
    .map(([, words]) => words)
    .join(' ')
  const name = tokens(food.name)
  return {
    food,
    boost,
    name,
    compact: name.join(''),
    extra: tokens(`${aliasText} ${food.brand ?? ''} ${food.group ?? ''}`),
  }
}

function allowedTypos(length: number): number {
  if (length >= 7) return 2
  if (length >= 4) return 1
  return 0
}

function wordScore(q: string, t: string): number {
  if (q === t) return 1
  if (t.startsWith(q)) return q.length >= 2 ? 0.9 : 0.5
  const max = allowedTypos(q.length)
  if (max === 0) return 0
  const whole = editDistance(q, t, max)
  if (whole <= max) return 0.8 - 0.1 * (whole - 1)
  if (t.length > q.length) {
    const start = editDistance(q, t.slice(0, q.length), max)
    if (start <= max) return 0.65 - 0.1 * (start - 1)
  }
  return 0
}

function best(q: string, words: readonly string[]): number {
  let top = 0
  for (const w of words) {
    const s = wordScore(q, w)
    if (s > top) top = s
    if (top === 1) break
  }
  return top
}

/** 0 = no match; higher = better. Every query word has to match something. */
export function scoreFood(entry: FoodIndexEntry, query: string): number {
  const qWords = tokens(query)
  if (!qWords.length) return 0
  let total = 0
  for (const q of qWords) {
    let s = best(q, entry.name)
    if (s < 1) s = Math.max(s, best(q, entry.extra) * 0.9)
    if (s < 0.7 && q.length >= 4 && entry.compact.includes(q)) s = Math.max(s, 0.7)
    if (s === 0) return 0
    total += s
  }
  let score = total / qWords.length
  const qJoined = qWords.join(' ')
  const nJoined = entry.name.join(' ')
  if (nJoined === qJoined) score += 0.5
  else if (nJoined.startsWith(qJoined)) score += 0.25
  // Shorter names first: "Banana" before "Banana bread with walnuts".
  score -= 0.02 * Math.max(0, entry.name.length - qWords.length)
  return score + entry.boost
}

/**
 * Search foods. The same food can be in more than one source (a favourite that
 * is also a USDA food): the first copy in `index` wins, so list own foods and
 * favourites first.
 */
export function searchFoods(index: readonly FoodIndexEntry[], query: string, limit = 50): Food[] {
  if (normalize(query) === '') return []
  const seen = new Set<string>()
  const results: { food: Food; score: number }[] = []
  for (const entry of index) {
    if (seen.has(entry.food.id)) continue
    const score = scoreFood(entry, query)
    if (score <= 0) continue
    seen.add(entry.food.id)
    results.push({ food: entry.food, score })
  }
  results.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
  return results.slice(0, limit).map((r) => r.food)
}

/** Boosts for each source. */
export const BOOST = { custom: 0.15, favorite: 0.1, usda: 0, off: -0.05 } as const
