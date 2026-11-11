import { ProgramTag, QuestXp } from '../../components/QuestRow'
import { MinusIcon, PlusIcon } from '../../components/icons'
import type { Quest } from '../../lib/db'

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

interface CountQuestRowProps {
  quest: Quest
  onStep: (direction: 1 | -1) => void
  /** Read-only (a past day outside the grace period): no − / + buttons. */
  locked?: boolean
  /** The program this quest is a rule of (shown as a tag). */
  programName?: string
}

/** A number-target quest (e.g. 3 L water): progress bar plus − / + buttons. */
export function CountQuestRow({ quest, onStep, locked = false, programName }: CountQuestRowProps) {
  const value = quest.value ?? 0
  const target = quest.target ?? 1
  const unit = quest.unit ? ` ${quest.unit}` : ''
  const step = `${fmt.format(quest.step ?? 1)}${unit}`
  const fraction = Math.min(1, value / target)

  return (
    <div className="flex min-h-[58px] items-center gap-3.5 py-2">
      <span
        aria-hidden="true"
        className={`grid size-[26px] shrink-0 place-content-center ${quest.done ? 'bg-accent' : 'border-2 border-faint'}`}
      >
        {quest.done && (
          <svg viewBox="0 0 24 24" className="size-[22px] stroke-on-accent" fill="none" strokeWidth={3} strokeLinecap="square">
            <path d="M6.5 12.5l3.5 3.5 7.5-8" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className={`font-medium ${quest.done ? 'text-muted' : ''}`}>{quest.title}</span>
          {programName && <ProgramTag name={programName} />}
        </span>
        <span className="block text-xs text-muted">
          {fmt.format(value)} of {fmt.format(target)}
          {unit}
        </span>
        <div
          role="progressbar"
          aria-label={`${quest.title} progress`}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={value}
          aria-valuetext={`${fmt.format(value)} of ${fmt.format(target)}${unit}`}
          className="mt-1.5 h-1.5 bg-line"
        >
          <div className="h-full bg-accent" style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
      {!locked && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={value <= 0}
            aria-label={`Remove ${step} from ${quest.title}`}
            className="grid size-touch place-items-center border border-panel-edge text-muted hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-panel-edge disabled:hover:text-muted"
          >
            <MinusIcon size={20} />
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label={`Add ${step} to ${quest.title}`}
            className="grid size-touch place-items-center bg-accent text-on-accent hover:bg-text"
          >
            <PlusIcon size={20} />
          </button>
        </div>
      )}
      <QuestXp xp={quest.xp} done={quest.done} />
    </div>
  )
}
