import { heightUnitsOf, type HeightUnits, type UnitSystem } from '../../lib/units'
import { useProfile } from './goals/goalsRepo'
import { setHeightUnits, setUnits, useUnits } from './units'

function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
  compact,
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (v: T) => void
  compact: boolean
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex border border-line">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-touch font-display font-bold uppercase tracking-wider ${compact ? 'min-w-11 px-2 text-sm' : 'min-w-16 px-4'} ${
            value === v ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const WEIGHT: readonly (readonly [UnitSystem, string])[] = [
  ['metric', 'kg'],
  ['imperial', 'lb'],
]
const HEIGHT: readonly (readonly [HeightUnits, string])[] = [
  ['cm', 'cm'],
  ['ftin', 'ft/in'],
]

/** Square kg / lb switch. */
export function UnitToggle({ compact = false }: { compact?: boolean }) {
  const units = useUnits()
  return <Toggle label="Weight unit" options={WEIGHT} value={units} onChange={(u) => void setUnits(u)} compact={compact} />
}

/** Square cm / ft-in switch. */
export function HeightUnitToggle() {
  const profile = useProfile()
  const value = heightUnitsOf(profile ?? { units: 'metric' })
  return <Toggle label="Height unit" options={HEIGHT} value={value} onChange={(h) => void setHeightUnits(h)} compact={false} />
}
