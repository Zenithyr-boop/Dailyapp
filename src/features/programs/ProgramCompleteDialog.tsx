import { useEffect, useId, useRef } from 'react'
import type { ProgramCelebration } from './programsRepo'

const fmt = new Intl.NumberFormat()

/** The rank-violet "System window" moment for finishing a program. Dismissed by the user. */
export function ProgramCompleteDialog({ celebration, onClose }: { celebration: ProgramCelebration; onClose: () => void }) {
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { name, xp, daysDone, length } = celebration

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    buttonRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/85 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Tab') e.preventDefault() // one control: keep focus on it
        }}
        className="w-full max-w-sm border-2 border-rank bg-panel"
      >
        <p className="border-b border-line-soft px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.16em] text-rank">
          Program complete
        </p>
        <div className="px-5 py-6">
          <div className="flex items-center gap-4">
            <ProgramBadgeMark size="lg" />
            <div className="min-w-0">
              <h2 id={titleId} className="text-4xl font-extrabold leading-none text-rank">
                {name}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {daysDone === length ? `All ${length} days done.` : `${daysDone} of ${length} days done.`} Badge earned.
              </p>
            </div>
          </div>
          <p className="mt-5 border-t border-line-soft pt-4 font-display text-3xl font-bold tabular-nums text-rank">
            +{fmt.format(xp)} XP
          </p>
        </div>
        <div className="px-5 pb-5">
          <button
            ref={buttonRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-touch w-full items-center justify-center bg-rank font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

/** The badge shape: a square in the rank violet with a 3×3 block of finished days. */
export function ProgramBadgeMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'size-14 p-2.5 gap-1' : 'size-11 p-2 gap-0.5'
  return (
    <span aria-hidden="true" className={`grid shrink-0 grid-cols-3 border-2 border-rank ${box}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="bg-rank" />
      ))}
    </span>
  )
}
