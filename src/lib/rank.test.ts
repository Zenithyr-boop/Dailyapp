import { evaluateRank, nextRank, RANK_TRIALS, type Rank, type Trial } from './rank'

describe('evaluateRank (level trials)', () => {
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
    expect(evaluateRank({ level })).toBe(rank)
  })

  it('never drops below a rank already earned', () => {
    expect(evaluateRank({ level: 3 }, 'C')).toBe('C')
  })

  it('still rises above the earned rank', () => {
    expect(evaluateRank({ level: 21 }, 'C')).toBe('B')
  })
})

describe('evaluateRank with extra trials', () => {
  const goal = (min: number): Trial => ({ stat: 'goalsReached', min, label: `Reach ${min} goals` })
  const trials: Record<Rank, Trial[]> = {
    ...RANK_TRIALS,
    D: [...RANK_TRIALS.D, goal(1)],
    C: [...RANK_TRIALS.C, goal(3)],
  } as Record<Rank, Trial[]>

  it('needs every trial, not just the level', () => {
    expect(evaluateRank({ level: 12, goalsReached: 1 }, 'E', trials)).toBe('D')
    expect(evaluateRank({ level: 12, goalsReached: 3 }, 'E', trials)).toBe('C')
  })

  it('cannot skip a rank whose trial fails', () => {
    expect(evaluateRank({ level: 25, goalsReached: 0 }, 'E', trials)).toBe('E')
  })

  it('skips trials for stats that are not tracked yet', () => {
    expect(evaluateRank({ level: 12 }, 'E', trials)).toBe('C')
  })
})

describe('nextRank', () => {
  it('lists the next rank and its trials', () => {
    const next = nextRank('E', { level: 3 })
    expect(next?.rank).toBe('D')
    expect(next?.trials).toEqual([{ trial: RANK_TRIALS.D[0], passed: false }])
  })

  it('is undefined at S', () => {
    expect(nextRank('S', { level: 80 })).toBeUndefined()
  })
})
