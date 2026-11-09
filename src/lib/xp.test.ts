import {
  ALL_QUESTS_BONUS,
  BASE_XP,
  clampQuestXp,
  dayXp,
  DIFFICULTIES,
  difficultyForXp,
  isDayComplete,
  levelFromTotalXp,
  QUEST_XP_MAX,
  QUEST_XP_MIN,
  totalXpForLevel,
  xpToNext,
} from './xp'

/** A full day with the default quests: 120 + 60 + 40 + 40 + 30 + 30 + bonus. */
const FULL_DAY = 320 + ALL_QUESTS_BONUS

function fullDaysToReach(level: number): number {
  return Math.ceil(totalXpForLevel(level) / FULL_DAY)
}

describe('xpToNext', () => {
  it('starts at the base cost', () => {
    expect(xpToNext(1)).toBe(BASE_XP)
  })

  it('grows about 6% per level (exponential)', () => {
    for (let l = 1; l < 60; l++) {
      const ratio = xpToNext(l + 1) / xpToNext(l)
      expect(ratio).toBeGreaterThan(1.04)
      expect(ratio).toBeLessThan(1.08)
    }
    // Exponential, not linear: the step between levels keeps getting bigger.
    expect(xpToNext(41) - xpToNext(40)).toBeGreaterThan(xpToNext(11) - xpToNext(10))
  })

  it('is a whole multiple of 10', () => {
    for (let l = 1; l < 80; l++) expect(xpToNext(l) % 10).toBe(0)
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
})

describe('pacing with full default days (400 XP)', () => {
  it('reaches Level 2 within the first few days', () => {
    expect(fullDaysToReach(2)).toBeLessThanOrEqual(3)
  })

  it('reaches Level 10 in about 3–4 weeks', () => {
    expect(fullDaysToReach(10)).toBeGreaterThanOrEqual(21)
    expect(fullDaysToReach(10)).toBeLessThanOrEqual(28)
  })

  it('takes over a year of full days to reach Level 50', () => {
    expect(fullDaysToReach(50)).toBeGreaterThan(365)
    expect(fullDaysToReach(50)).toBeLessThan(730)
  })
})

describe('levelFromTotalXp', () => {
  it('handles zero and negatives', () => {
    expect(levelFromTotalXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForLevel: BASE_XP, fraction: 0 })
    expect(levelFromTotalXp(-50).level).toBe(1)
  })

  it('levels up exactly on the boundary', () => {
    expect(levelFromTotalXp(BASE_XP - 1).level).toBe(1)
    expect(levelFromTotalXp(BASE_XP).level).toBe(2)
    expect(levelFromTotalXp(BASE_XP).xpIntoLevel).toBe(0)
  })

  it('reports progress within a level', () => {
    const p = levelFromTotalXp(BASE_XP + xpToNext(2) / 2)
    expect(p.level).toBe(2)
    expect(p.fraction).toBe(0.5)
  })

  it('round-trips with totalXpForLevel', () => {
    for (let l = 1; l <= 80; l++) expect(levelFromTotalXp(totalXpForLevel(l)).level).toBe(l)
  })
})

describe('quest XP', () => {
  it('offers difficulty presets inside the allowed range, easiest first', () => {
    for (const d of DIFFICULTIES) {
      expect(d.xp).toBeGreaterThanOrEqual(QUEST_XP_MIN)
      expect(d.xp).toBeLessThanOrEqual(QUEST_XP_MAX)
    }
    const values = DIFFICULTIES.map((d) => d.xp)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
  })

  it('matches a preset by XP value', () => {
    expect(difficultyForXp(60)?.label).toBe('Hard')
    expect(difficultyForXp(35)).toBeUndefined()
  })

  it('clamps and rounds custom values', () => {
    expect(clampQuestXp(0)).toBe(QUEST_XP_MIN)
    expect(clampQuestXp(5000)).toBe(QUEST_XP_MAX)
    expect(clampQuestXp(33)).toBe(35)
    expect(clampQuestXp(Number.NaN)).toBe(QUEST_XP_MIN)
  })
})

describe('dayXp', () => {
  it('adds the bonus only when every quest is done', () => {
    expect(dayXp([{ xp: 20, done: true }, { xp: 30, done: false }])).toBe(20)
    expect(dayXp([{ xp: 20, done: true }, { xp: 30, done: true }])).toBe(50 + ALL_QUESTS_BONUS)
  })

  it('gives nothing for an empty day', () => {
    expect(dayXp([])).toBe(0)
    expect(isDayComplete([])).toBe(false)
  })
})
