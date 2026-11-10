/**
 * Movement search: tolerant of typos, partial words, word order and a few gym
 * abbreviations. Pure functions, unit-tested in `search.test.ts`.
 *
 * Ranking: coach's picks that match well come first, then the user's custom
 * movements, then everything else; within each group the best match wins.
 */
import type { Movement } from './types'

export interface MovementFilters {
  /** Primary muscle is any of these. */
  muscles: ReadonlySet<string>
  equipment: ReadonlySet<string>
  categories: ReadonlySet<string>
}

export const NO_FILTERS: MovementFilters = { muscles: new Set(), equipment: new Set(), categories: new Set() }

/** Extra words a movement can be found by (abbreviations, other common names). */
const ALIASES: readonly [RegExp, string][] = [
  [/romanian deadlift/, 'rdl'],
  [/stiff.?legged?/, 'sldl'],
  [/military press|shoulder press/, 'overhead press ohp'],
  [/^barbell squat$|^barbell full squat$/, 'back squat'],
  [/dumbbell/, 'db'],
  [/barbell/, 'bb'],
  [/e-?z.?(curl )?bar/, 'ez'],
  [/kettlebell/, 'kb'],
  [/leverage|machine/, 'machine'],
  [/butterfly/, 'pec deck chest fly'],
  [/flye?s?\b/, 'fly'],
  [/pullups|pull-ups?/, 'pull up pullup'],
  [/chin-ups?/, 'chinup'],
  [/push-ups?|pushups/, 'push up pushup press up'],
  [/skull ?crusher/, 'skullcrusher skull crusher'],
  [/hyperextensions/, 'back extension'],
  [/lat pulldown/, 'pulldown'],
  [/triceps pushdown/, 'pressdown'],
  [/bicycling|recumbent bike/, 'bike cycling'],
  [/rowing, stationary|rowing stationary/, 'rower erg'],
  [/treadmill/, 'run'],
  [/kettlebell swings/, 'swing'],
  [/farmers walk/, 'carry'],
  [/side lateral raise/, 'lateral raise'],
  [/reverse flyes/, 'rear delt fly'],
  [/hip thrust/, 'glute bridge'],
]

/** Everyday words for the dataset's muscle names, so "abs" or "legs" finds them. */
const MUSCLE_WORDS: Record<string, string> = {
  abdominals: 'abs core',
  quadriceps: 'quads legs',
  hamstrings: 'hams legs',
  glutes: 'glute butt legs',
  calves: 'legs',
  adductors: 'inner thigh legs',
  abductors: 'outer thigh legs',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'delts',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms grip',
}

const IRREGULAR: Record<string, string> = { crunches: 'crunch', lunges: 'lunge', presses: 'press', raises: 'raise' }

/** Lowercase, no accents, punctuation → spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Crude singular form, so "curls" finds "curl" and "pullups" finds "pullup". */
export function stem(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word]
  if (word.length > 4 && /(ches|shes|xes)$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean).map(stem)
}

/** Edit distance with adjacent swaps counted as one ("benhc" → "bench" = 1). */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length]![b.length]!
}

/** Typos allowed for a query word of this length. */
function allowedTypos(length: number): number {
  if (length >= 7) return 2
  if (length >= 4) return 1
  return 0
}

/** How well one query word matches one word of a movement, 0..1. */
function wordScore(q: string, t: string): number {
  if (q === t) return 1
  if (t.startsWith(q)) return 0.9
  const max = allowedTypos(q.length)
  if (max === 0) return 0
  const whole = editDistance(q, t, max)
  if (whole <= max) return 0.8 - 0.1 * (whole - 1)
  // A partly typed word with a typo: compare against the start of the word.
  if (t.length > q.length) {
    const start = editDistance(q, t.slice(0, q.length), max)
    if (start <= max) return 0.65 - 0.1 * (start - 1)
  }
  return 0
}

export interface SearchIndexEntry {
  movement: Movement
  name: string[]
  /** Name with no spaces, for "pushup" vs "push up". */
  compact: string
  aliases: string[]
  meta: string[]
}

export function indexMovement(movement: Movement): SearchIndexEntry {
  const lower = movement.name.toLowerCase()
  const aliasText = ALIASES.filter(([re]) => re.test(lower))
    .map(([, words]) => words)
    .join(' ')
  const name = tokens(movement.name)
  return {
    movement,
    name,
    compact: name.join(''),
    aliases: tokens(aliasText),
    meta: tokens(
      [...movement.primaryMuscles.map((m) => `${m} ${MUSCLE_WORDS[m] ?? ''}`), movement.equipment, movement.category].join(' '),
    ),
  }
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
export function scoreEntry(entry: SearchIndexEntry, query: string): number {
  const qWords = tokens(query)
  if (!qWords.length) return 0
  let total = 0
  for (const q of qWords) {
    let s = best(q, entry.name)
    if (s < 1) s = Math.max(s, best(q, entry.aliases) * 0.95)
    if (s < 0.7 && q.length >= 4 && entry.compact.includes(q)) s = Math.max(s, 0.7)
    if (s < 0.65) s = Math.max(s, best(q, entry.meta) * 0.65)
    if (s === 0) return 0
    total += s
  }
  let score = total / qWords.length
  const qJoined = qWords.join(' ')
  const nJoined = entry.name.join(' ')
  if (nJoined === qJoined) score += 0.5
  else if (nJoined.startsWith(qJoined + ' ')) score += 0.2
  // Prefer shorter names: "Barbell Deadlift" before "Deficit Deadlift With Chains".
  score -= 0.01 * Math.max(0, entry.name.length - qWords.length)
  return score
}

export function matchesFilters(m: Movement, f: MovementFilters): boolean {
  if (f.muscles.size && !m.primaryMuscles.some((x) => f.muscles.has(x))) return false
  if (f.equipment.size && !f.equipment.has(m.equipment)) return false
  if (f.categories.size && !f.categories.has(m.category)) return false
  return true
}

/** A pick must match at least this well to jump ahead of everything else. */
const PICK_MIN_SCORE = 0.6

/**
 * Filter and rank movements. With no query: picks (in the coach's order),
 * then custom movements, then the rest A–Z.
 */
export function searchMovements(
  index: readonly SearchIndexEntry[],
  query: string,
  filters: MovementFilters,
  picks: readonly string[],
): Movement[] {
  const pickOrder = new Map(picks.map((id, i) => [id, i]))
  const tier = (m: Movement, score: number) =>
    pickOrder.has(m.id) && score >= PICK_MIN_SCORE ? 2 : m.source === 'custom' ? 1 : 0
  const hasQuery = normalize(query) !== ''

  const results: { m: Movement; score: number; tier: number }[] = []
  for (const entry of index) {
    const m = entry.movement
    if (!matchesFilters(m, filters)) continue
    const score = hasQuery ? scoreEntry(entry, query) : 1
    if (score <= 0) continue
    results.push({ m, score, tier: tier(m, score) })
  }

  // Picks that match about equally well keep the coach's order (most common first).
  const bucket = (r: { score: number; tier: number }) => (r.tier === 2 ? Math.round(r.score * 10) : r.score)
  results.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier
    if (hasQuery && bucket(a) !== bucket(b)) return bucket(b) - bucket(a)
    if (a.tier === 2) return pickOrder.get(a.m.id)! - pickOrder.get(b.m.id)!
    return a.m.name.localeCompare(b.m.name)
  })
  return results.map((r) => r.m)
}
