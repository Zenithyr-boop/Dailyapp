import type { UnitSystem } from '../../lib/units'
import { setUnits, useUnits } from './units'

/** Square kg / lb switch. */
export function UnitToggle({ compact = false }: { compact?: boolean }) {
  const units = useUnits()
  const options: [UnitSystem, string][] = [
    ['metric', 'kg'],
    ['imperial', 'lb'],
  ]
  return (
    <div role="group" aria-label="Weight unit" className="inline-flex border border-line">
      {options.map(([value, text]) => (
        <button
          key={value}
          type="button"
          aria-pressed={units === value}
          onClick={() => setUnits(value)}
          className={`min-h-touch font-display font-bold uppercase tracking-wider ${compact ? 'min-w-11 px-2 text-sm' : 'min-w-16 px-4'} ${
            units === value ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
