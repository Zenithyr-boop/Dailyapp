/**
 * XP, level, difficulty and day-XP math. All progression numbers live here.
 * Ranks (which depend on more than level) live in `rank.ts`.
 *
 * XP needed to go from level n to n+1 grows exponentially, +6% per level,
 * rounded to the nearest 10:
 *   xpToNext(n) = round10(BASE_XP * GROWTH^(n - 1))
 *
 * With the default quests a full day is 400 XP (320 + 80 bonus), so:
 *   Level 2 ≈ 2 full days, Level 10 ≈ 24, Level 20 ≈ 72 (2.4 months),
 *   Level 35 ≈ 221 (7 months), Level 50 ≈ 580 (19 months).
 */

export const BASE_XP = 850
export const GROWTH = 1.06
/** Bonus for finishing every quest of the day. */
export const ALL_QUESTS_BONUS = 80

/** XP a quest can be worth. Keeps pacing sane and squads comparable. */
export const QUEST_XP_MIN = 10
export const QUEST_XP_MAX = 150

export interface Difficulty {
  id: 'easy' | 'medium' | 'hard' | 'very-hard' | 'extreme'
  label: string
  xp: number
}

/** Presets offered when creating a quest; the user can fine-tune within min/max. */
export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: 'Easy', xp: 20 },
  { id: 'medium', label: 'Medium', xp: 40 },
  { id: 'hard', label: 'Hard', xp: 60 },
  { id: 'very-hard', label: 'Very hard', xp: 90 },
  { id: 'extreme', label: 'Extreme', xp: 120 },
]

/** The preset an XP value matches exactly, or undefined for a custom value. */
export function difficultyForXp(xp: number): Difficulty | undefined {
  return DIFFICULTIES.find((d) => d.xp === xp)
}

/** Clamp a user-entered XP value into the allowed range (whole multiples of 5). */
export function clampQuestXp(xp: number): number {
  if (!Number.isFinite(xp)) return QUEST_XP_MIN
  const rounded = Math.round(xp / 5) * 5
  return Math.min(QUEST_XP_MAX, Math.max(QUEST_XP_MIN, rounded))
}

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`level must be an integer >= 1, got ${level}`)
  }
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  assertLevel(level)
  return Math.round((BASE_XP * GROWTH ** (level - 1)) / 10) * 10
}

/** Cumulative totals, grown on demand: TOTALS[i] = XP to reach level i + 1. */
const TOTALS: number[] = [0]

/** Total XP needed to reach `level` from zero (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  assertLevel(level)
  while (TOTALS.length < level) {
    const l = TOTALS.length // level whose cost we add next
    TOTALS.push(TOTALS[l - 1]! + xpToNext(l))
  }
  return TOTALS[level - 1]!
}

export interface LevelProgress {
  level: number
  /** XP earned inside the current level. */
  xpIntoLevel: number
  /** XP the current level needs in total to level up. */
  xpForLevel: number
  /** 0–1 progress through the current level. */
  fraction: number
}

/** Work out level and progress from a lifetime XP total. */
export function levelFromTotalXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (totalXpForLevel(level + 1) <= xp) level++
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpForLevel = xpToNext(level)
  return { level, xpIntoLevel, xpForLevel, fraction: xpIntoLevel / xpForLevel }
}

/** XP earned for a day: sum of completed quests, plus the bonus if all are done. */
export function dayXp(quests: ReadonlyArray<{ xp: number; done: boolean }>): number {
  const earned = quests.reduce((sum, q) => sum + (q.done ? q.xp : 0), 0)
  return earned + (isDayComplete(quests) ? ALL_QUESTS_BONUS : 0)
}

/** A day is complete when it has quests and every one is done. */
export function isDayComplete(quests: ReadonlyArray<{ done: boolean }>): boolean {
  return quests.length > 0 && quests.every((q) => q.done)
}
