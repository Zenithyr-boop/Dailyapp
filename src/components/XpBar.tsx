const SEGMENTS = 10

interface XpBarProps {
  current: number
  max: number
  label?: string
  /** Large header version: big level label, taller blocks. */
  size?: 'sm' | 'lg'
}

const fmt = new Intl.NumberFormat()

/** 10-block segmented XP bar with "current / max XP" numbers. */
export function XpBar({ current, max, label = 'XP', size = 'sm' }: XpBarProps) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0
  const filled = Math.floor(fraction * SEGMENTS)
  const lg = size === 'lg'

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span
          className={
            lg
              ? 'font-display text-2xl font-bold uppercase leading-none tracking-wide md:text-3xl'
              : 'label'
          }
        >
          {label}
        </span>
        <span className="text-sm tabular-nums text-muted">
          <span className="text-text">{fmt.format(current)}</span> / {fmt.format(max)} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${fmt.format(current)} of ${fmt.format(max)} XP`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        className="grid grid-cols-10 gap-1"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} className={`${lg ? 'h-2.5 md:h-3.5' : 'h-2.5'} ${i < filled ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>
    </div>
  )
}
