import { lbToKg } from '../../../lib/units'
import { CALORIE_FLOOR } from './coachTargets'
import {
  ageFrom,
  bmr,
  calculateTargets,
  formatRate,
  isFastestRate,
  kcalFromMacros,
  nearestRateOption,
  rateOptions,
  referenceWeightKg,
  splitMacros,
  type BodyStats,
} from './targets'

const YEAR = 2026
const man: BodyStats = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate' }
const woman: BodyStats = { sex: 'female', birthYear: 1996, heightCm: 160, weightKg: 50, activity: 'sedentary' }

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches the published formula', () => {
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780)
    expect(bmr({ sex: 'female', age: 30, heightCm: 160, weightKg: 50 })).toBe(1189)
    // Prefer not to say: midpoint of the two constants.
    expect(bmr({ sex: 'unspecified', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780 - 83)
  })

  it('works out age from the birth year', () => {
    expect(ageFrom(1996, YEAR)).toBe(30)
  })
})

describe('calculateTargets', () => {
  it('needs height, weight, birth year and activity', () => {
    expect(calculateTargets(undefined, { goal: 'maintain', rateKgPerWeek: 0 }, YEAR)).toBeUndefined()
    expect(calculateTargets({ ...man, heightCm: undefined }, { goal: 'maintain', rateKgPerWeek: 0 }, YEAR)).toBeUndefined()
  })

  it('maintenance = BMR × activity', () => {
    const t = calculateTargets(man, { goal: 'maintain', rateKgPerWeek: 0.5 }, YEAR)!
    expect(t.bmr).toBe(1780)
    expect(t.maintenance).toBe(2760) // 1780 × 1.55 = 2759 → nearest 10
    expect(t.kcal).toBe(2760)
    expect(t.rateKgPerWeek).toBe(0)
  })

  it('takes 7,700 kcal per kg off for a loss goal, then splits macros', () => {
    const t = calculateTargets(man, { goal: 'lose', rateKgPerWeek: 0.5 }, YEAR)!
    expect(t.kcal).toBe(2210) // 2759 − 550
    expect(t.proteinG).toBe(160) // 2.0 g/kg
    expect(t.fatG).toBe(64) // 25% of kcal = 61 g, below the 0.8 g/kg minimum
    expect(t.carbsG).toBe(249) // the rest
    expect(t.capped).toBe(false)
    expect(t.floored).toBe(false)
    expect(t.expectedKgPerWeek).toBeCloseTo(-0.5, 2)
  })

  it('adds calories for a gain goal', () => {
    const t = calculateTargets(man, { goal: 'gain', rateKgPerWeek: 0.25 }, YEAR)!
    expect(t.kcal).toBe(3030) // 2759 + 275
    expect(t.proteinG).toBe(144) // 1.8 g/kg
  })

  it('caps weight loss at 1% of body weight per week', () => {
    const t = calculateTargets({ ...man, weightKg: 60 }, { goal: 'lose', rateKgPerWeek: 1 }, YEAR)!
    expect(t.capped).toBe(true)
    expect(t.rateKgPerWeek).toBeCloseTo(0.6)
    expect(t.expectedKgPerWeek).toBeCloseTo(-0.6, 1)
  })

  it('never goes below the calorie floor', () => {
    const t = calculateTargets(woman, { goal: 'lose', rateKgPerWeek: 0.5 }, YEAR)!
    expect(t.floored).toBe(true)
    expect(t.kcal).toBe(CALORIE_FLOOR.female)
    expect(t.floor).toBe(1200)
    // The real rate is slower than asked for.
    expect(t.expectedKgPerWeek).toBeGreaterThan(-0.5)
    expect(t.expectedKgPerWeek).toBeLessThan(0)
    expect(t).toMatchObject({ proteinG: 100, fatG: 40, carbsG: 110 })
  })

  it('uses the "prefer not to say" floor when sex is missing', () => {
    const t = calculateTargets({ ...woman, sex: undefined }, { goal: 'lose', rateKgPerWeek: 1 }, YEAR)!
    expect(t.kcal).toBe(CALORIE_FLOOR.unspecified)
  })

  it('macros add up to the calories (within rounding)', () => {
    for (const goal of ['lose', 'maintain', 'gain'] as const) {
      const t = calculateTargets(man, { goal, rateKgPerWeek: 0.5 }, YEAR)!
      expect(Math.abs(kcalFromMacros(t) - t.kcal)).toBeLessThanOrEqual(10)
    }
  })
})

describe('reference weight', () => {
  it('is actual weight up to BMI 30, then the weight at BMI 30', () => {
    expect(referenceWeightKg(80, 180)).toBe(80)
    expect(referenceWeightKg(150, 175)).toBeCloseTo(91.875)
    const t = calculateTargets({ ...man, weightKg: 150, heightCm: 175 }, { goal: 'lose', rateKgPerWeek: 0.5 }, YEAR)!
    expect(t.proteinG).toBe(184) // 2.0 × 91.9, not 300
  })
})

describe('splitMacros', () => {
  it('drops fat to its minimum, and carbs never go negative, on a tight budget', () => {
    expect(splitMacros(1000, 100, 'lose')).toEqual({ proteinG: 200, fatG: 80, carbsG: 0 })
  })
})

describe('rate options', () => {
  it('offers kg or lb steps', () => {
    expect(rateOptions('lose', 'metric').map((o) => o.shown)).toEqual([0.25, 0.5, 0.75, 1])
    expect(rateOptions('lose', 'imperial').map((o) => o.shown)).toEqual([0.5, 1, 1.5, 2])
    expect(rateOptions('lose', 'imperial')[1]!.kg).toBeCloseTo(lbToKg(1))
  })

  it('matches a stored rate to the nearest option in either unit', () => {
    expect(nearestRateOption('lose', 'imperial', 0.5).shown).toBe(1)
    expect(nearestRateOption('lose', 'metric', lbToKg(1)).shown).toBe(0.5)
  })

  it('knows the fastest option', () => {
    expect(isFastestRate('lose', 'metric', 1)).toBe(true)
    expect(isFastestRate('lose', 'metric', 0.75)).toBe(false)
    expect(isFastestRate('lose', 'imperial', lbToKg(2))).toBe(true)
    expect(isFastestRate('gain', 'metric', 0.5)).toBe(true)
    expect(isFastestRate('maintain', 'metric', 0)).toBe(false)
  })

  it('formats rates in the user units', () => {
    expect(formatRate(0.5, 'metric')).toBe('0.5 kg')
    expect(formatRate(lbToKg(1), 'imperial')).toBe('1 lb')
    expect(formatRate(lbToKg(1.993), 'imperial', { approx: true })).toBe('2 lb')
  })
})
