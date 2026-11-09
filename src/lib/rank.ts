/**
 * Ranks E → S. A rank is earned by passing its "trials": a minimum level plus
 * (later) requirements from other areas — goals reached, strength relative to
 * body weight, progress toward the person's own body goal.
 *
 * Rules:
 * - Ranks are earned in order: you can't skip a rank's trials.
 * - A trial whose stat isn't tracked yet (feature not built, or the user hasn't
 *   set it up) is skipped rather than blocking the rank.
 * - Once earned, a rank never drops (injury, illness, a bulk never cost a rank).
 *
 * Today only the level trial exists; the Train/Body/Food features add the rest
 * by extending `RankStats` and `RANK_TRIALS`.
 */

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export const RANKS: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S']

/** Everything a rank trial can look at. Undefined = not tracked yet. */
export interface RankStats {
  level: number
  /** Personal goals reached (Body/Food/Programs features). */
  goalsReached?: number
}

export interface Trial {
  stat: keyof RankStats
  /** Minimum value of `stat` to pass. */
  min: number
  /** Short requirement text, e.g. "Reach Level 10". */
  label: string
}

const levelTrial = (min: number): Trial => ({ stat: 'level', min, label: `Reach Level ${min}` })

/** Trials per rank. Rank E is where everyone starts. */
export const RANK_TRIALS: Readonly<Record<Rank, readonly Trial[]>> = {
  E: [],
  D: [levelTrial(5)],
  C: [levelTrial(10)],
  B: [levelTrial(20)],
  A: [levelTrial(35)],
  S: [levelTrial(50)],
}

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank)
}

export function trialPassed(trial: Trial, stats: RankStats): boolean {
  const value = stats[trial.stat]
  return value === undefined || value >= trial.min
}

/**
 * The rank someone holds: the highest rank whose trials (and every lower rank's)
 * they pass, never lower than the rank they already earned.
 */
export function evaluateRank(
  stats: RankStats,
  earned: Rank = 'E',
  trials: Readonly<Record<Rank, readonly Trial[]>> = RANK_TRIALS,
): Rank {
  let reached: Rank = 'E'
  for (const rank of RANKS) {
    if (!trials[rank].every((t) => trialPassed(t, stats))) break
    reached = rank
  }
  return rankIndex(reached) > rankIndex(earned) ? reached : earned
}

export interface NextRank {
  rank: Rank
  /** Trials for that rank, with whether each is passed. */
  trials: { trial: Trial; passed: boolean }[]
}

/** What's needed for the rank after `current`, or undefined at S. */
export function nextRank(
  current: Rank,
  stats: RankStats,
  trials: Readonly<Record<Rank, readonly Trial[]>> = RANK_TRIALS,
): NextRank | undefined {
  const next = RANKS[rankIndex(current) + 1]
  if (!next) return undefined
  return { rank: next, trials: trials[next].map((trial) => ({ trial, passed: trialPassed(trial, stats) })) }
}
