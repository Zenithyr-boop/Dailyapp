import {
  ALL_QUESTS_BONUS,
  dayXp,
  levelFromTotalXp,
  rankForLevel,
  totalXpForLevel,
  xpToNext,
} from './xp'

describe('xpToNext', () => {
  it('starts at 100 and grows by 50 per level', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(2)).toBe(150)
    expect(xpToNext(10)).toBe(550)
  })

  it('never shrinks', () => {
    for (let l = 1; l < 100; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l))
  })

  it('rejects invalid levels', () => {
    expect(() => xpToNext(0)).toThrow(RangeError)
    expect(() => xpToNext(1.5)).toThrow(RangeError)
  })
})

describe('totalXpForLevel', () => {
  it('is the running sum of xpToNext', () => {
    let sum = 0
    for (let l = 1; l <= 60; l++) {
      expect(totalXpForLevel(l)).toBe(sum)
      sum += xpToNext(l)
    }
  })

  it('needs 63,700 XP for level 50', () => {
    expect(totalXpForLevel(50)).toBe(63_700)
  })
})

describe('levelFromTotalXp', () => {
  it('handles zero and negatives', () => {
    expect(levelFromTotalXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForLevel: 100, fraction: 0 })
    expect(levelFromTotalXp(-50).level).toBe(1)
  })

  it('levels up exactly on the boundary', () => {
    expect(levelFromTotalXp(99).level).toBe(1)
    expect(levelFromTotalXp(100).level).toBe(2)
    expect(levelFromTotalXp(100).xpIntoLevel).toBe(0)
  })

  it('reports progress within a level', () => {
    const p = levelFromTotalXp(175) // level 2 starts at 100 and needs 150
    expect(p.level).toBe(2)
    expect(p.xpIntoLevel).toBe(75)
    expect(p.fraction).toBe(0.5)
  })

  it('round-trips with totalXpForLevel', () => {
    for (let l = 1; l <= 80; l++) expect(levelFromTotalXp(totalXpForLevel(l)).level).toBe(l)
  })
})

describe('rankForLevel', () => {
  it.each([
    [1, 'E'],
    [4, 'E'],
    [5, 'D'],
    [9, 'D'],
    [10, 'C'],
    [19, 'C'],
    [20, 'B'],
    [34, 'B'],
    [35, 'A'],
    [49, 'A'],
    [50, 'S'],
    [120, 'S'],
  ] as const)('level %i is rank %s', (level, rank) => {
    expect(rankForLevel(level)).toBe(rank)
  })
})

describe('dayXp', () => {
  it('adds the bonus only when every quest is done', () => {
    expect(dayXp([{ xp: 20, done: true }, { xp: 30, done: false }])).toBe(20)
    expect(dayXp([{ xp: 20, done: true }, { xp: 30, done: true }])).toBe(50 + ALL_QUESTS_BONUS)
  })

  it('gives nothing for an empty day', () => {
    expect(dayXp([])).toBe(0)
  })
})
