import { useEffect, useId, useRef } from 'react'
import { RankBadge } from '../../components/RankBadge'
import type { Rank } from '../../lib/rank'

interface LevelUpDialogProps {
  level: number
  /** Set when this level-up also earned a new rank. */
  rank?: Rank
  currentRank: Rank
  onClose: () => void
}

/** Short flat "System window" moment in the rank violet. Dismissed by the user. */
export function LevelUpDialog({ level, rank, currentRank, onClose }: LevelUpDialogProps) {
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

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
          {rank ? 'Rank up' : 'Level up'}
        </p>
        <div className="flex items-center gap-4 px-5 py-6">
          <RankBadge rank={rank ?? currentRank} size="lg" />
          <div>
            <h2 id={titleId} className="text-4xl font-extrabold leading-none text-rank">
              {rank ? `Rank ${rank}` : `Level ${level}`}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {rank ? `You reached Level ${level} and earned a new rank.` : 'Keep clearing your quests.'}
            </p>
          </div>
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
