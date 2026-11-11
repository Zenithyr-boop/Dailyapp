import { useId } from 'react'

interface QuestRowProps {
  title: string
  xp: number
  done: boolean
  /** Small grey line under the title. */
  sub?: string
  onToggle: (done: boolean) => void
  /** Read-only (a past day outside the grace period). */
  locked?: boolean
  /** The program this quest is a rule of (shown as a tag). */
  programName?: string
}

/** One checkbox quest: square checkbox, title, XP value. Whole row is the hit area. */
export function QuestRow({ title, xp, done, sub, onToggle, locked = false, programName }: QuestRowProps) {
  const id = useId()
  return (
    <label htmlFor={id} className={`flex min-h-[58px] items-center gap-3.5 py-2 ${locked ? '' : 'cursor-pointer'}`}>
      <input
        id={id}
        type="checkbox"
        checked={done}
        disabled={locked}
        onChange={(e) => onToggle(e.target.checked)}
        className="peer grid size-[26px] shrink-0 cursor-pointer appearance-none disabled:cursor-default place-content-center border-2 border-faint checked:border-accent checked:bg-accent"
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
        <span className="flex flex-wrap items-center gap-x-2">
          <span className={`font-medium ${done ? 'text-muted' : ''}`}>{title}</span>
          {programName && <ProgramTag name={programName} />}
        </span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <QuestXp xp={xp} done={done} />
    </label>
  )
}

/** Small tag naming the program a quest belongs to ("66-day reset"). */
export function ProgramTag({ name }: { name: string }) {
  return (
    <span className="border border-accent px-1 font-display text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-accent">
      <span className="sr-only">Program: </span>
      {name}
    </span>
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
