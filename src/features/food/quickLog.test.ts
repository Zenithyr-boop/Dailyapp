import { describe, expect, it } from 'vitest'
import { parseQuickLog, quickPortion } from './quickLog'

describe('parseQuickLog', () => {
  it.each([
    ['chicken breast and rice - 500', 'Chicken breast and rice', 500],
    ['chicken and rice 500 cal', 'Chicken and rice', 500],
    ['chicken and rice 500cal', 'Chicken and rice', 500],
    ['Chicken and rice 500 kcal', 'Chicken and rice', 500],
    ['pizza, 2 slices: 600 calories', 'Pizza, 2 slices', 600],
    ['kcal 350 protein bar', 'Protein bar', 350],
    ['2 eggs and toast 350', '2 eggs and toast', 350],
    ["Mom's lasagna 650", "Mom's lasagna", 650],
    ['latte = 190', 'Latte', 190],
    ['banana 105.5', 'Banana', 106],
  ])('reads "%s"', (text, name, kcal) => {
    expect(parseQuickLog(text)).toEqual({ name, kcal })
  })

  it('picks up macros when they are there', () => {
    expect(parseQuickLog('500 cal 40p 50c 12f')).toEqual({ name: '', kcal: 500, proteinG: 40, carbsG: 50, fatG: 12 })
    expect(parseQuickLog('burrito bowl 650 kcal 45g protein 70g carbs 18g fat')).toEqual({
      name: 'Burrito bowl',
      kcal: 650,
      proteinG: 45,
      carbsG: 70,
      fatG: 18,
    })
    expect(parseQuickLog('shake p30 c10 f3 200')).toEqual({ name: 'Shake', kcal: 200, proteinG: 30, carbsG: 10, fatG: 3 })
    expect(parseQuickLog('protein shake 30p 150')).toEqual({ name: 'Protein shake', kcal: 150, proteinG: 30 })
    expect(parseQuickLog('steak, protein: 50, 400 cal')).toEqual({ name: 'Steak', kcal: 400, proteinG: 50 })
  })

  it('works out calories from the macros when only macros are given', () => {
    expect(parseQuickLog('snack 20p 30c 10f')).toEqual({ name: 'Snack', kcal: 290, proteinG: 20, carbsG: 30, fatG: 10 })
  })

  it('treats text without a calorie number as a search', () => {
    expect(parseQuickLog('banana')).toBeUndefined()
    expect(parseQuickLog('2 eggs')).toBeUndefined()
    expect(parseQuickLog('eggs 2')).toBeUndefined()
    expect(parseQuickLog('chicken breast')).toBeUndefined()
    expect(parseQuickLog('')).toBeUndefined()
    expect(parseQuickLog('chicken 0 cal')).toBeUndefined()
    expect(parseQuickLog('feast 20000 cal')).toBeUndefined()
  })

  it('doesn’t mistake words for macros', () => {
    expect(parseQuickLog('fish and chips 840')).toEqual({ name: 'Fish and chips', kcal: 840 })
    expect(parseQuickLog('cappuccino 120 cal')).toEqual({ name: 'Cappuccino', kcal: 120 })
    expect(parseQuickLog('fat free yogurt 90')).toEqual({ name: 'Fat free yogurt', kcal: 90 })
  })
})

describe('quickPortion', () => {
  it('marks missing macros so totals can say so', () => {
    expect(quickPortion({ name: 'Chicken and rice', kcal: 500 })).toEqual({
      name: 'Chicken and rice',
      kcal: 500,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      missing: ['proteinG', 'carbsG', 'fatG'],
    })
    expect(quickPortion({ name: '', kcal: 300, proteinG: 25 })).toMatchObject({ name: 'Quick log', proteinG: 25, missing: ['carbsG', 'fatG'] })
    expect(quickPortion({ name: 'Bowl', kcal: 500, proteinG: 40, carbsG: 50, fatG: 12 }).missing).toBeUndefined()
  })
})
