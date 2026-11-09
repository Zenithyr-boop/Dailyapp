import { formatWeight, kgToLb, lbToKg, toKg } from './units'

describe('units', () => {
  it('converts kg and lb both ways', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3)
    expect(lbToKg(kgToLb(82.5))).toBeCloseTo(82.5, 10)
  })

  it('formats for each unit system', () => {
    expect(formatWeight(100, 'metric')).toBe('100.0 kg')
    expect(formatWeight(100, 'imperial')).toBe('220.5 lb')
  })

  it('stores input as kg', () => {
    expect(toKg(80, 'metric')).toBe(80)
    expect(toKg(220.462262, 'imperial')).toBeCloseTo(100, 6)
  })
})
