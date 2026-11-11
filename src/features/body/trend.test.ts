import { addDays } from '../../lib/day'
import { estimateGoal, movingAverage, rangeStart, signed, trendWeight, weeklyRate, type WeighIn } from './trend'

const TODAY = '2026-11-10'
/** One weigh-in per day ending today, `perDay` kg change a day. */
function daily(n: number, start: number, perDay: number): WeighIn[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays(TODAY, i - (n - 1)), value: start + perDay * i }))
}

describe('movingAverage', () => {
  it('averages the weigh-ins of the last 7 calendar days', () => {
    const pts = daily(10, 80, 0).map((p, i) => ({ ...p, value: 80 + i }))
    const avg = movingAverage(pts)
    expect(avg[0]).toBe(80)
    expect(avg[6]).toBe(83) // 80..86
    expect(avg[9]).toBe(86) // 83..89
  })

  it('does not stretch the window over missed days', () => {
    const pts: WeighIn[] = [
      { date: '2026-11-01', value: 90 },
      { date: '2026-11-07', value: 80 }, // 6 days later: still inside
      { date: '2026-11-08', value: 82 }, // 7 days after the first: it drops out
    ]
    expect(movingAverage(pts)).toEqual([90, 85, 81])
  })

  it('handles nothing and one weigh-in', () => {
    expect(movingAverage([])).toEqual([])
    expect(trendWeight([])).toBeUndefined()
    expect(trendWeight([{ date: TODAY, value: 75 }])).toBe(75)
  })
})

describe('weeklyRate', () => {
  it('is the slope of the last 28 days in kg per week', () => {
    expect(weeklyRate(daily(28, 90, -0.1), TODAY)).toBeCloseTo(-0.7, 6)
    expect(weeklyRate(daily(14, 70, 0.05), TODAY)).toBeCloseTo(0.35, 6)
  })

  it('ignores weigh-ins older than the window', () => {
    const old = daily(10, 100, 0).map((p) => ({ ...p, date: addDays(p.date, -60) }))
    expect(weeklyRate([...old, ...daily(20, 90, -0.1)], TODAY)).toBeCloseTo(-0.7, 6)
  })

  it('needs at least 4 weigh-ins spread over a week', () => {
    expect(weeklyRate(daily(3, 80, -0.1), TODAY)).toBeUndefined()
    expect(weeklyRate(daily(6, 80, -0.1), TODAY)).toBeUndefined() // only 5 days apart
    const spread = [0, 3, 5, 8].map((d) => ({ date: addDays(TODAY, d - 8), value: 80 - d * 0.1 }))
    expect(weeklyRate(spread, TODAY)).toBeCloseTo(-0.7, 6)
  })
})

describe('estimateGoal', () => {
  const base = { today: TODAY }
  it('gives a date when moving toward the goal', () => {
    expect(estimateGoal({ ...base, current: 80, goal: 76, rate: -0.5 })).toEqual({ kind: 'date', date: '2027-01-05', days: 56 })
    expect(estimateGoal({ ...base, current: 70, goal: 72, rate: 0.25 })).toMatchObject({ kind: 'date', days: 56 })
  })

  it('says when it can’t give one', () => {
    expect(estimateGoal({ ...base, current: 80, goal: undefined, rate: -0.5 }).kind).toBe('no-goal')
    expect(estimateGoal({ ...base, current: undefined, goal: 75, rate: -0.5 }).kind).toBe('no-data')
    expect(estimateGoal({ ...base, current: 75.2, goal: 75, rate: undefined }).kind).toBe('reached')
    expect(estimateGoal({ ...base, current: 80, goal: 75, rate: undefined }).kind).toBe('need-rate')
    expect(estimateGoal({ ...base, current: 80, goal: 75, rate: 0.3 }).kind).toBe('not-heading')
    expect(estimateGoal({ ...base, current: 80, goal: 75, rate: -0.01 }).kind).toBe('not-heading')
    expect(estimateGoal({ ...base, current: 100, goal: 70, rate: -0.2 }).kind).toBe('too-far')
  })
})

describe('helpers', () => {
  it('works out range starts', () => {
    expect(rangeStart('1m', TODAY)).toBe('2026-10-12')
    expect(rangeStart('all', TODAY)).toBeUndefined()
  })

  it('formats signed changes', () => {
    expect(signed(-0.44)).toBe('−0.4')
    expect(signed(1.25, 2)).toBe('+1.25')
    expect(signed(-0.01)).toBe('0.0')
  })
})
