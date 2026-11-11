/**
 * Weight trend maths: 7-day moving average, weekly rate of change and an
 * estimated date to reach the goal weight. Pure functions (unit-tested in
 * `trend.test.ts`). All weights in kg.
 *
 * The numbers below are the coach's to tune.
 */
import { addDays, daysBetween } from '../../lib/day'

/** Moving average window, in calendar days (missed days don't stretch it). */
export const AVERAGE_DAYS = 7
/** The weekly rate is a best-fit line through the weigh-ins of the last … days. */
export const RATE_WINDOW_DAYS = 28
/** …needing at least this many weigh-ins… */
export const RATE_MIN_POINTS = 4
/** …spread over at least this many days. */
export const RATE_MIN_SPAN_DAYS = 7
/** Within this of the goal (kg) counts as reached. */
export const GOAL_REACHED_KG = 0.3
/** Slower than this (kg/week) counts as holding steady. */
export const STEADY_KG_PER_WEEK = 0.05
/** Estimates further out than this aren't shown as a date. */
export const MAX_ESTIMATE_DAYS = 730

export interface WeighIn {
  date: string
  value: number
}

/**
 * The trailing moving average at each weigh-in: the mean of the weigh-ins in
 * the `windowDays` calendar days ending that day. `points` must be sorted by date.
 */
export function movingAverage(points: readonly WeighIn[], windowDays = AVERAGE_DAYS): number[] {
  const out: number[] = []
  let start = 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    sum += points[i]!.value
    while (daysBetween(points[start]!.date, points[i]!.date) >= windowDays) sum -= points[start++]!.value
    out.push(sum / (i - start + 1))
  }
  return out
}

/** Today's trend weight: the moving average as of the latest weigh-in. */
export function trendWeight(points: readonly WeighIn[]): number | undefined {
  return movingAverage(points).at(-1)
}

/**
 * Weekly rate of change (kg/week, negative = losing): the slope of a
 * least-squares line through the weigh-ins of the last `RATE_WINDOW_DAYS`.
 * Undefined until there's enough data to say.
 */
export function weeklyRate(points: readonly WeighIn[], today: string): number | undefined {
  const from = addDays(today, -(RATE_WINDOW_DAYS - 1))
  const recent = points.filter((p) => p.date >= from && p.date <= today)
  if (recent.length < RATE_MIN_POINTS) return undefined
  const xs = recent.map((p) => daysBetween(from, p.date))
  if (xs.at(-1)! - xs[0]! < RATE_MIN_SPAN_DAYS) return undefined
  const n = recent.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = recent.reduce((a, p) => a + p.value, 0) / n
  let num = 0
  let den = 0
  recent.forEach((p, i) => {
    num += (xs[i]! - mx) * (p.value - my)
    den += (xs[i]! - mx) ** 2
  })
  return den === 0 ? undefined : (num / den) * 7
}

export type GoalEstimate =
  | { kind: 'no-goal' }
  | { kind: 'no-data' }
  | { kind: 'reached' }
  /** Not enough weigh-ins yet for a rate. */
  | { kind: 'need-rate' }
  /** Holding steady or moving away from the goal. */
  | { kind: 'not-heading' }
  /** More than `MAX_ESTIMATE_DAYS` away at this rate. */
  | { kind: 'too-far' }
  | { kind: 'date'; date: string; days: number }

export function estimateGoal(args: {
  current: number | undefined
  goal: number | undefined
  rate: number | undefined
  today: string
}): GoalEstimate {
  const { current, goal, rate, today } = args
  if (goal === undefined) return { kind: 'no-goal' }
  if (current === undefined) return { kind: 'no-data' }
  const diff = goal - current
  if (Math.abs(diff) <= GOAL_REACHED_KG) return { kind: 'reached' }
  if (rate === undefined) return { kind: 'need-rate' }
  if (Math.abs(rate) < STEADY_KG_PER_WEEK || Math.sign(rate) !== Math.sign(diff)) return { kind: 'not-heading' }
  const days = Math.ceil((diff / rate) * 7)
  if (days > MAX_ESTIMATE_DAYS) return { kind: 'too-far' }
  return { kind: 'date', date: addDays(today, days), days }
}

/** Chart ranges. */
export const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
] as const
export type RangeId = (typeof RANGES)[number]['id']

export function isRangeId(v: unknown): v is RangeId {
  return RANGES.some((r) => r.id === v)
}

/** First day shown for a range (undefined = everything). */
export function rangeStart(range: RangeId, today: string): string | undefined {
  const days = RANGES.find((r) => r.id === range)!.days
  return Number.isFinite(days) ? addDays(today, -(days - 1)) : undefined
}

/** Change between two values, as a signed string with the unit ("−0.4 kg", "+1.2 kg"). */
export function signed(n: number, decimals = 1): string {
  const r = +n.toFixed(decimals)
  if (r === 0) return (0).toFixed(decimals)
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(decimals)}`
}
