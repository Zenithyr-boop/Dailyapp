/**
 * XP, level and rank math. All progression numbers live here.
 *
 * XP needed to go from level n to n+1 grows linearly:
 *   xpToNext(n) = BASE_XP + STEP_XP * (n - 1)
 * so level 1 → 2 costs 100, level 10 → 11 costs 550, level 49 → 50 costs 2,500.
 * Reaching level 50 (S rank) takes 63,700 XP in total.
 */

export const BASE_XP = 100
export const STEP_XP = 50
/** Bonus for finishing every quest of the day. */
export const ALL_QUESTS_BONUS = 80

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

/** Lowest level of each rank, highest rank first. */
const RANK_FLOORS: ReadonlyArray<readonly [Rank, number]> = [
  ['S', 50],
  ['A', 35],
  ['B', 20],
  ['C', 10],
  ['D', 5],
  ['E', 1],
]

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`level must be an integer >= 1, got ${level}`)
  }
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  assertLevel(level)
  return BASE_XP + STEP_XP * (level - 1)
}

/** Total XP needed to reach `level` from zero (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  assertLevel(level)
  const n = level - 1 // number of level-ups
  return BASE_XP * n + (STEP_XP * n * (n - 1)) / 2
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

export function rankForLevel(level: number): Rank {
  assertLevel(level)
  for (const [rank, floor] of RANK_FLOORS) {
    if (level >= floor) return rank
  }
  return 'E'
}

/** XP earned for a day: sum of completed quests, plus the bonus if all are done. */
export function dayXp(quests: ReadonlyArray<{ xp: number; done: boolean }>): number {
  const earned = quests.reduce((sum, q) => sum + (q.done ? q.xp : 0), 0)
  const allDone = quests.length > 0 && quests.every((q) => q.done)
  return earned + (allDone ? ALL_QUESTS_BONUS : 0)
}
