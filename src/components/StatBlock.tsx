interface StatBlockProps {
  label: string
  value: string | number
  unit?: string
}

/** Label over a big condensed number. */
export function StatBlock({ label, value, unit }: StatBlockProps) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 font-display text-3xl font-bold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
      </div>
    </div>
  )
}
