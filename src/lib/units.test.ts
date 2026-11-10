import { cmToFtIn, formatHeight, formatWeight, ftInToCm, heightUnitsOf, kgToLb, lbToKg, toKg } from './units'

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

describe('height', () => {
  it('converts cm and ft/in both ways', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, inches: 11 })
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, inches: 0 })
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34)
  })

  it('formats in either unit', () => {
    expect(formatHeight(180, 'cm')).toBe('180 cm')
    expect(formatHeight(180, 'ftin')).toBe('5 ft 11 in')
  })

  it('follows the weight unit until chosen', () => {
    expect(heightUnitsOf({ units: 'imperial' })).toBe('ftin')
    expect(heightUnitsOf({ units: 'imperial', heightUnits: 'cm' })).toBe('cm')
    expect(heightUnitsOf({ units: 'metric' })).toBe('cm')
  })
})
