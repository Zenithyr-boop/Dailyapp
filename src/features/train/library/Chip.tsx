import type { ButtonHTMLAttributes } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
}

/** Square toggle chip for filters and multi-select fields. */
export function Chip({ selected, className = '', ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-touch shrink-0 items-center whitespace-nowrap border px-3 font-display text-sm font-semibold uppercase tracking-wider transition-colors ${
        selected ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-faint hover:text-text'
      } ${className}`}
      {...rest}
    />
  )
}

/** Small non-interactive tag (Coach's pick, Custom, category). */
export function Tag({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'accent' }) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-display text-[0.7rem] font-semibold uppercase leading-none tracking-wider ${
        tone === 'accent' ? 'border-accent text-accent' : 'border-line text-muted'
      }`}
    >
      {children}
    </span>
  )
}
