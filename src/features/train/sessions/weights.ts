/**
 * Weights in the user's units. Stored values are always kg. Converting for
 * display rounds to a real plate increment (`PLATE_STEP`), except values the
 * user typed in that unit, which come back exactly (185 lb stays 185 lb).
 */
import { kgToLb, lbToKg, type UnitSystem } from '../../../lib/units'
import { PLATE_STEP } from './progression'

/** Round to a multiple of `step` without float noise (82.49999 → 82.5). */
export function roundToStep(value: number, step: number): number {
  return +(Math.round(value / step) * step).toFixed(4)
}

export function unitLabel(units: UnitSystem): 'kg' | 'lb' {
  return units === 'metric' ? 'kg' : 'lb'
}

/**
 * A stored kg value in the user's units, for showing or prefilling.
 * Typed values (two decimals at most in that unit) survive the round trip;
 * anything else is rounded to the plate step.
 */
export function displayWeight(kg: number, units: UnitSystem): number {
  const value = units === 'metric' ? kg : kgToLb(kg)
  const exact = Math.round(value * 100) / 100
  if (Math.abs(value - exact) < 1e-6) return exact
  return roundToStep(value, PLATE_STEP[units])
}

/** A weight typed in the user's units, as kg for storage. */
export function weightToKg(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : lbToKg(value)
}

/** A kg value rounded to what the user can actually load, still in kg. */
export function plateRoundKg(kg: number, units: UnitSystem): number {
  const shown = units === 'metric' ? roundToStep(kg, PLATE_STEP.metric) : roundToStep(kgToLb(kg), PLATE_STEP.imperial)
  return weightToKg(shown, units)
}

/** "82.5", "185" — a number for display, no trailing zeros. */
export function formatNumber(n: number): string {
  return String(+n.toFixed(2))
}

/** "82.5 kg" / "185 lb". */
export function formatWeight(kg: number, units: UnitSystem): string {
  return `${formatNumber(displayWeight(kg, units))} ${unitLabel(units)}`
}
