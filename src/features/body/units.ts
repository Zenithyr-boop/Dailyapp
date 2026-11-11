/**
 * Body values in the user's units. Stored metric (kg, cm); shown in kg/lb
 * (profile `units`) and cm/in (follows the height setting: ft/in → inches).
 */
import type { MeasureKey, Profile } from '../../lib/db'
import { heightUnitsOf, kgToLb, lbToKg, type UnitSystem } from '../../lib/units'

export type LengthUnit = 'cm' | 'in'
const CM_PER_INCH = 2.54

export const weightUnit = (units: UnitSystem) => (units === 'metric' ? 'kg' : 'lb')
export const lengthUnitOf = (p: Pick<Profile, 'units' | 'heightUnits'>): LengthUnit => (heightUnitsOf(p) === 'cm' ? 'cm' : 'in')

/** kg → the user's unit, 1 decimal. */
export const showKg = (kg: number, units: UnitSystem) => Math.round((units === 'metric' ? kg : kgToLb(kg)) * 10) / 10
export const fromShownWeight = (v: number, units: UnitSystem) => (units === 'metric' ? v : lbToKg(v))

/** cm → the user's unit, 1 decimal. */
export const showCm = (cm: number, unit: LengthUnit) => Math.round((unit === 'cm' ? cm : cm / CM_PER_INCH) * 10) / 10
export const fromShownLength = (v: number, unit: LengthUnit) => (unit === 'cm' ? v : v * CM_PER_INCH)

/** "82.5" (always one decimal, so the column lines up). */
export const fmt1 = (n: number) => n.toFixed(1)

/** Input limits in the shown unit. */
export const WEIGHT_LIMITS = { metric: { min: 20, max: 350 }, imperial: { min: 44, max: 770 } } as const
export const LENGTH_LIMITS = { cm: { min: 10, max: 250 }, in: { min: 4, max: 100 } } as const

/**
 * The five measurements, with how to take each one. The hints are the
 * coach's to edit.
 */
export const MEASURES: readonly { key: MeasureKey; label: string; hint: string }[] = [
  { key: 'waistCm', label: 'Waist', hint: 'Around the belly button, relaxed, after breathing out.' },
  { key: 'chestCm', label: 'Chest', hint: 'Around the fullest part, arms down, tape level.' },
  { key: 'hipsCm', label: 'Hips', hint: 'Around the widest part of the glutes, feet together.' },
  { key: 'armCm', label: 'Arms', hint: 'Relaxed upper arm at its widest. Same side every time.' },
  { key: 'thighCm', label: 'Thighs', hint: 'Widest part of the upper thigh, standing. Same side every time.' },
]

export function isMeasureKey(v: unknown): v is MeasureKey {
  return MEASURES.some((m) => m.key === v)
}

export const measureLabel = (key: MeasureKey) => MEASURES.find((m) => m.key === key)!.label
