import type { Day, Quest, QuestDef } from '../../lib/db'
import { addToCount, bestRun, buildHistory, completeDateSet, computeStreak, mergeQuests } from './progress'

const check = (id: string, done: boolean, xp = 10): Quest => ({ id, title: id, xp, kind: 'check', done })
const day = (date: string, quests: Quest[]): Day => ({ date, quests, updatedAt: 0 })
const full = (date: string) => day(date, [check('a', true), check('b', true)])
const partial = (date: string) => day(date, [check('a', true), check('b', false)])

describe('computeStreak', () => {
  it('counts back from today when today is complete', () => {
    const days = [full('2026-11-07'), full('2026-11-08'), full('2026-11-09')]
    expect(computeStreak(completeDateSet(days), '2026-11-09')).toBe(3)
  })

  it('counts back from yesterday while today is still in progress', () => {
    const days = [full('2026-11-07'), full('2026-11-08'), partial('2026-11-09')]
    expect(computeStreak(completeDateSet(days), '2026-11-09')).toBe(2)
  })

  it('resets to 0 after a missed day', () => {
    // Nothing on the 8th: the app wasn't opened, so that day was missed.
    const days = [full('2026-11-06'), full('2026-11-07'), partial('2026-11-09')]
    expect(computeStreak(completeDateSet(days), '2026-11-09')).toBe(0)
  })

  it('resets to 0 after an incomplete day', () => {
    const days = [full('2026-11-06'), partial('2026-11-07'), full('2026-11-08')]
    expect(computeStreak(completeDateSet(days), '2026-11-08')).toBe(1)
  })

  it('works across month boundaries', () => {
    const days = [full('2026-10-31'), full('2026-11-01')]
    expect(computeStreak(completeDateSet(days), '2026-11-01')).toBe(2)
  })
})

describe('count quests', () => {
  const water: Quest = { id: 'w', title: 'Water', xp: 20, kind: 'count', target: 3, unit: 'L', step: 0.1, value: 0, done: false }

  it('is done once the target is reached', () => {
    let q = water
    for (let i = 0; i < 29; i++) q = addToCount(q, 0.1)
    expect(q.value).toBe(2.9)
    expect(q.done).toBe(false)
    q = addToCount(q, 0.1)
    expect(q.value).toBe(3)
    expect(q.done).toBe(true)
  })

  it('never goes below zero', () => {
    expect(addToCount(water, -1).value).toBe(0)
  })
})

describe('mergeQuests', () => {
  const def = (id: string, order: number, extra: Partial<QuestDef> = {}): QuestDef => ({
    id,
    title: id.toUpperCase(),
    xp: 30,
    kind: 'check',
    order,
    updatedAt: 0,
    ...extra,
  })

  it('keeps progress, applies edits, adds new and drops removed quests', () => {
    const existing = [check('a', true), check('gone', true)]
    const merged = mergeQuests(existing, [def('b', 0), def('a', 1, { xp: 60 })])
    expect(merged.map((q) => q.id)).toEqual(['b', 'a'])
    expect(merged[1]).toMatchObject({ title: 'A', xp: 60, done: true })
    expect(merged[0]?.done).toBe(false)
  })

  it('resets progress when the quest type changes', () => {
    const merged = mergeQuests([check('a', true)], [def('a', 0, { kind: 'count', target: 3, step: 1 })])
    expect(merged[0]).toMatchObject({ kind: 'count', value: 0, done: false })
  })

  it('re-checks done when a count target changes', () => {
    const existing: Quest[] = [{ id: 'a', title: 'A', xp: 30, kind: 'count', target: 3, step: 1, value: 2, done: false }]
    const merged = mergeQuests(existing, [def('a', 0, { kind: 'count', target: 2, step: 1 })])
    expect(merged[0]?.done).toBe(true)
  })
})

describe('buildHistory', () => {
  it('returns 30 days oldest first with a status for each', () => {
    const cells = buildHistory([full('2026-11-07'), partial('2026-11-09')], '2026-11-09')
    expect(cells).toHaveLength(30)
    expect(cells[29]).toMatchObject({ date: '2026-11-09', status: 'partial', done: 1, total: 2 })
    expect(cells[28]).toMatchObject({ date: '2026-11-08', status: 'missed' })
    expect(cells[27]).toMatchObject({ date: '2026-11-07', status: 'full', xp: 20 + 80 })
    expect(cells[0]?.status).toBe('before-start')
  })

  it('finds the best run of full days', () => {
    const cells = buildHistory(
      [full('2026-11-03'), full('2026-11-04'), full('2026-11-05'), partial('2026-11-06'), full('2026-11-07')],
      '2026-11-09',
    )
    expect(bestRun(cells)).toBe(3)
  })
})
