import { useId } from 'react'

interface QuestRowProps {
  title: string
  xp: number
  done: boolean
  /** Small grey line under the title. */
  sub?: string
  onToggle: (done: boolean) => void
}

/** One checkbox quest: square checkbox, title, XP value. Whole row is the hit area. */
export function QuestRow({ title, xp, done, sub, onToggle }: QuestRowProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-[58px] cursor-pointer items-center gap-3.5 py-2">
      <input
        id={id}
        type="checkbox"
        checked={done}
        onChange={(e) => onToggle(e.target.checked)}
        className="peer grid size-[26px] shrink-0 cursor-pointer appearance-none place-content-center border-2 border-faint checked:border-accent checked:bg-accent"
      />
      {/* Check mark drawn over the box when checked. */}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none -ml-[40px] size-[26px] shrink-0 stroke-on-accent p-0.5 opacity-0 peer-checked:opacity-100"
        fill="none"
        strokeWidth={3}
        strokeLinecap="square"
        aria-hidden="true"
      >
        <path d="M6.5 12.5l3.5 3.5 7.5-8" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${done ? 'text-muted' : ''}`}>{title}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <QuestXp xp={xp} done={done} />
    </label>
  )
}

/** "+120 XP" in accent, greyed once the quest is done. */
export function QuestXp({ xp, done }: { xp: number; done: boolean }) {
  return (
    <span className={`shrink-0 font-display text-base font-semibold tabular-nums ${done ? 'text-muted' : 'text-accent'}`}>
      +{xp}
      <span className="sr-only md:not-sr-only"> XP</span>
    </span>
  )
}
