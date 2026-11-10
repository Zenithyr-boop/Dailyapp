/** Unit conversion. Data is always stored metric; convert only for display/input. */

export type UnitSystem = 'metric' | 'imperial'

const LB_PER_KG = 2.20462262

export const kgToLb = (kg: number): number => kg * LB_PER_KG
export const lbToKg = (lb: number): number => lb / LB_PER_KG

/** Format a stored kg value for the user's unit system, e.g. "82.5 kg" / "181.9 lb". */
export function formatWeight(kg: number, units: UnitSystem, decimals = 1): string {
  const value = units === 'metric' ? kg : kgToLb(kg)
  return `${value.toFixed(decimals)} ${units === 'metric' ? 'kg' : 'lb'}`
}

/** Convert user input in their unit system back to kg for storage. */
export function toKg(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : lbToKg(value)
}

// ---- Height ----------------------------------------------------------------

/** Height unit, chosen separately from weight. */
export type HeightUnits = 'cm' | 'ftin'

const CM_PER_INCH = 2.54

/** Whole feet and inches (rounded to the nearest inch). */
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH)
  return { ft: Math.floor(total / 12), inches: total % 12 }
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_INCH
}

/** "180 cm" / "5 ft 11 in". */
export function formatHeight(cm: number, units: HeightUnits): string {
  if (units === 'cm') return `${Math.round(cm)} cm`
  const { ft, inches } = cmToFtIn(cm)
  return `${ft} ft ${inches} in`
}

/** The height unit to use: the saved choice, or the one matching the weight unit. */
export function heightUnitsOf(p: { units: UnitSystem; heightUnits?: HeightUnits }): HeightUnits {
  return p.heightUnits ?? (p.units === 'imperial' ? 'ftin' : 'cm')
}
