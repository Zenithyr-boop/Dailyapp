import { defaultTitle, describeLink, evaluateLink, linkSummary, normalizeLink, type LinkData } from './links'

const data = (d: Partial<LinkData> = {}): LinkData => ({ kcal: 0, proteinG: 0, foodEntries: 0, workouts: 0, goals: {}, ...d })

describe('evaluateLink', () => {
  it('steps, sleep and water tick at their numbers', () => {
    expect(evaluateLink({ source: 'steps', target: 8000 }, data({ steps: 7999 })).done).toBe(false)
    expect(evaluateLink({ source: 'steps', target: 8000 }, data({ steps: 8000 })).done).toBe(true)
    expect(evaluateLink({ source: 'sleep', target: 420 }, data({ sleepMinutes: 430 })).done).toBe(true)
    expect(evaluateLink({ source: 'sleep', target: 420 }, data()).done).toBe(false)
    expect(evaluateLink({ source: 'water', target: 3000 }, data({ waterMl: 3000 })).done).toBe(true)
  })

  it('protein follows the protein goal', () => {
    expect(evaluateLink({ source: 'protein' }, data({ proteinG: 160, goals: { proteinG: 150 } })).done).toBe(true)
    expect(evaluateLink({ source: 'protein' }, data({ proteinG: 149, goals: { proteinG: 150 } })).done).toBe(false)
    expect(evaluateLink({ source: 'protein' }, data({ proteinG: 200 }))).toEqual({ done: false, missingGoal: 'protein' })
  })

  it('calories need food logged within ± the range of the goal', () => {
    const link = { source: 'calories' as const, target: 150 }
    const goals = { kcal: 2000 }
    expect(evaluateLink(link, data({ kcal: 2140, foodEntries: 5, goals })).done).toBe(true)
    expect(evaluateLink(link, data({ kcal: 1850, foodEntries: 5, goals })).done).toBe(true)
    expect(evaluateLink(link, data({ kcal: 1849, foodEntries: 5, goals })).done).toBe(false)
    expect(evaluateLink(link, data({ kcal: 2200, foodEntries: 5, goals })).done).toBe(false)
    expect(evaluateLink(link, data({ kcal: 0, foodEntries: 0, goals: { kcal: 100 } })).done).toBe(false)
    expect(evaluateLink(link, data({ kcal: 2000, foodEntries: 3 })).missingGoal).toBe('calories')
  })

  it('weigh-in and workout tick when there is one', () => {
    expect(evaluateLink({ source: 'weighIn' }, data({ weightKg: 80 })).done).toBe(true)
    expect(evaluateLink({ source: 'weighIn' }, data()).done).toBe(false)
    expect(evaluateLink({ source: 'workout' }, data({ workouts: 1 })).done).toBe(true)
    expect(evaluateLink({ source: 'workout' }, data()).done).toBe(false)
  })
})

describe('normalizeLink', () => {
  it('fills in defaults, clamps numbers and drops unused ones', () => {
    expect(normalizeLink({ source: 'steps' })).toEqual({ source: 'steps', target: 8000 })
    expect(normalizeLink({ source: 'steps', target: 10 })).toEqual({ source: 'steps', target: 500 })
    expect(normalizeLink({ source: 'sleep', target: 2000 })).toEqual({ source: 'sleep', target: 720 })
    expect(normalizeLink({ source: 'protein', target: 99 })).toEqual({ source: 'protein' })
  })
})

describe('text', () => {
  it('describes live progress', () => {
    expect(describeLink({ source: 'steps', target: 8000 }, data({ steps: 6240 }), 'metric')).toBe('6,240 / 8,000 steps')
    expect(describeLink({ source: 'sleep', target: 420 }, data({ sleepMinutes: 450 }), 'metric')).toBe('7 h 30 m / 7 h sleep')
    expect(describeLink({ source: 'water', target: 3000 }, data({ waterMl: 1500 }), 'metric')).toBe('1.5 L / 3 L')
    expect(describeLink({ source: 'water', target: 2957 }, data({ waterMl: 1479 }), 'imperial')).toBe('50 oz / 100 oz')
    expect(describeLink({ source: 'protein' }, data(), 'metric')).toBe('Set your protein goal in Me → Goals')
  })

  it('gives default titles and summaries', () => {
    expect(defaultTitle({ source: 'steps', target: 10000 }, 'metric')).toBe('Walk 10,000 steps')
    expect(defaultTitle({ source: 'water', target: 2500 }, 'metric')).toBe('Drink 2.5 L water')
    expect(linkSummary({ source: 'calories', target: 150 }, 'metric')).toBe('Calories within ± 150 kcal of your goal')
  })
})
