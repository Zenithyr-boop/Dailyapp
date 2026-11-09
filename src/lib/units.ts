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
