import { useId } from 'react'

interface QuestRowProps {
  title: string
  xp: number
  done: boolean
  onToggle: (done: boolean) => void
}

/** One daily quest: square checkbox, title, XP value. Whole row is the hit area. */
export function QuestRow({ title, xp, done, onToggle }: QuestRowProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="flex min-h-touch cursor-pointer items-center gap-3 border-b border-line-soft py-2 last:border-b-0"
    >
      <input
        id={id}
        type="checkbox"
        checked={done}
        onChange={(e) => onToggle(e.target.checked)}
        className="peer grid size-6 shrink-0 cursor-pointer appearance-none place-content-center border-2 border-faint checked:border-accent checked:bg-accent"
      />
      {/* Check mark drawn over the box when checked. */}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none -ml-9 size-6 shrink-0 stroke-on-accent opacity-0 peer-checked:opacity-100"
        fill="none"
        strokeWidth={3}
        strokeLinecap="square"
        aria-hidden="true"
      >
        <path d="M6.5 12.5l3.5 3.5 7.5-8" />
      </svg>
      <span className={`flex-1 ${done ? 'text-muted line-through decoration-faint' : ''}`}>{title}</span>
      <span className="font-display text-sm font-bold tabular-nums text-accent">+{xp} XP</span>
    </label>
  )
}
