const SEGMENTS = 10

interface XpBarProps {
  current: number
  max: number
  label?: string
}

/** 10-block segmented XP bar. */
export function XpBar({ current, max, label = 'XP' }: XpBarProps) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0
  const filled = Math.floor(fraction * SEGMENTS)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-display text-sm font-semibold tabular-nums text-muted">
          <span className="text-text">{current}</span> / {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        className="grid grid-cols-10 gap-1"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} className={`h-2.5 ${i < filled ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>
    </div>
  )
}
