import type { Day, Quest } from '../../lib/db'
import { addDays } from '../../lib/day'
import { evaluateProgram, gridColumns, programDayDone } from './progress'

const rule = (id: string, done: boolean, programId: string | undefined = 'p'): Quest => ({ id, title: id, xp: 40, kind: 'check', done, programId })
const own = (done: boolean): Quest => ({ id: 'own', title: 'own', xp: 40, kind: 'check', done })

/** Days from a map of date → [rule a done, rule b done]. */
function daysFrom(map: Record<string, [boolean, boolean]>) {
  const byDate = new Map<string, Day>(
    Object.entries(map).map(([date, [a, b]]) => [date, { date, quests: [rule('a', a), rule('b', b), own(false)], updatedAt: 1 }]),
  )
  return (date: string) => byDate.get(date)
}

const START = '2026-11-01'
const program = (strict: boolean, length = 10) => ({ id: 'p', length, strict, startDate: START })

describe('programDayDone', () => {
  it('needs every rule of the program done, ignoring the user’s other quests', () => {
    const day = (quests: Quest[]): Day => ({ date: START, quests, updatedAt: 1 })
    expect(programDayDone(day([rule('a', true), rule('b', true), own(false)]), 'p')).toBe(true)
    expect(programDayDone(day([rule('a', true), rule('b', false)]), 'p')).toBe(false)
    expect(programDayDone(day([own(true)]), 'p')).toBe(false) // no rules on record
    expect(programDayDone(undefined, 'p')).toBe(false)
  })
})

describe('evaluateProgram', () => {
  it('counts done days and marks today, yesterday (still open) and the days to come', () => {
    const today = addDays(START, 3) // day 4
    const p = evaluateProgram(program(true), daysFrom({ [START]: [true, true], [addDays(START, 1)]: [true, true] }), today)
    expect(p.days.slice(0, 5).map((d) => d.status)).toEqual(['done', 'done', 'open', 'today', 'future'])
    expect(p).toMatchObject({ dayNumber: 4, daysDone: 2, missed: 0, finished: false, startDate: START, newAttempts: [] })
    expect(p.lastDate).toBe(addDays(START, 9))
  })

  it('strict: a closed miss restarts the next day and records the attempt', () => {
    const today = addDays(START, 5)
    const map: Record<string, [boolean, boolean]> = {
      [START]: [true, true],
      [addDays(START, 1)]: [true, true],
      [addDays(START, 2)]: [true, false], // missed, and closed (older than yesterday)
      [addDays(START, 3)]: [true, true],
    }
    const p = evaluateProgram(program(true), daysFrom(map), today)
    expect(p.newAttempts).toEqual([{ startDate: START, endDate: addDays(START, 2), daysDone: 2, end: 'missed' }])
    expect(p.startDate).toBe(addDays(START, 3))
    expect(p.days[0]).toMatchObject({ n: 1, status: 'done' })
    // Day 5 (yesterday, nothing on record) is still open, so no second restart yet.
    expect(p.days.slice(1, 3).map((d) => d.status)).toEqual(['open', 'today'])
    expect(p.dayNumber).toBe(3)
  })

  it('strict: yesterday’s miss is not final until the grace window closes', () => {
    const today = addDays(START, 2)
    const p = evaluateProgram(program(true), daysFrom({ [START]: [true, true], [addDays(START, 1)]: [false, false] }), today)
    expect(p.newAttempts).toEqual([])
    expect(p.days[1]!.status).toBe('open')
  })

  it('strict: days with no record at all count as missed once closed, one restart per miss', () => {
    const today = addDays(START, 4)
    const p = evaluateProgram(program(true), daysFrom({}), today)
    // Days 1–3 are closed and empty: three restarts; day 4 (yesterday) is open.
    expect(p.newAttempts.map((a) => a.endDate)).toEqual([START, addDays(START, 1), addDays(START, 2)])
    expect(p.startDate).toBe(addDays(START, 3))
    expect(p.days.slice(0, 2).map((d) => d.status)).toEqual(['open', 'today'])
  })

  it('not strict: a miss is marked and the program goes on', () => {
    const today = addDays(START, 4)
    const map: Record<string, [boolean, boolean]> = { [START]: [true, true], [addDays(START, 1)]: [false, true], [addDays(START, 2)]: [true, true] }
    const p = evaluateProgram(program(false), daysFrom(map), today)
    expect(p.newAttempts).toEqual([])
    expect(p.days.slice(0, 5).map((d) => d.status)).toEqual(['done', 'missed', 'done', 'open', 'today'])
    expect(p).toMatchObject({ daysDone: 2, missed: 1, dayNumber: 5, finished: false })
  })

  it('finishes when the last day is done (strict) or every day is done or closed (not strict)', () => {
    const all: Record<string, [boolean, boolean]> = {}
    for (let i = 0; i < 7; i++) all[addDays(START, i)] = [true, true]
    const lastDay = addDays(START, 6)
    expect(evaluateProgram(program(true, 7), daysFrom(all), lastDay)).toMatchObject({ finished: true, daysDone: 7, dayNumber: 7 })

    const withMiss = { ...all, [addDays(START, 6)]: [false, false] as [boolean, boolean] }
    // The last day missed: not strict finishes once it closes, with 6 of 7 days.
    expect(evaluateProgram(program(false, 7), daysFrom(withMiss), lastDay).finished).toBe(false)
    expect(evaluateProgram(program(false, 7), daysFrom(withMiss), addDays(lastDay, 1)).finished).toBe(false)
    expect(evaluateProgram(program(false, 7), daysFrom(withMiss), addDays(lastDay, 2))).toMatchObject({ finished: true, daysDone: 6, missed: 1 })
  })
})

describe('gridColumns', () => {
  it('keeps the grid in a block', () => {
    expect(gridColumns(66)).toBe(11)
    expect(gridColumns(75)).toBe(15)
    expect(gridColumns(30)).toBe(10)
    expect(gridColumns(7)).toBe(7)
    expect(gridColumns(365)).toBeLessThanOrEqual(15)
  })
})
