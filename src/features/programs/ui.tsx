import { formatShort } from './format'
import { gridColumns, type ProgramDay, type ProgramDayStatus } from './progress'

const STATUS_LABEL: Record<ProgramDayStatus, string> = {
  done: 'done',
  missed: 'missed',
  open: 'still open',
  today: 'today',
  future: 'to come',
}

/** One square of the program grid. */
const SQUARE: Record<ProgramDayStatus, string> = {
  done: 'bg-accent',
  missed: 'border border-faint',
  today: 'border-2 border-accent',
  open: 'border border-dashed border-accent',
  future: 'bg-line',
}

function Square({ day }: { day: ProgramDay }) {
  const label = `Day ${day.n}, ${formatShort(day.date)}: ${STATUS_LABEL[day.status]}`
  return (
    <li className={`relative aspect-square ${SQUARE[day.status]}`} title={label} aria-current={day.status === 'today' ? 'date' : undefined}>
      <span className="sr-only">{label}</span>
      {day.status === 'missed' && (
        <svg viewBox="0 0 10 10" className="absolute inset-0 size-full stroke-muted" strokeWidth={1} aria-hidden="true" preserveAspectRatio="none">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      )}
    </li>
  )
}

/** The program as a grid of day squares (66 = 11 × 6). */
export function ProgramGrid({ days, length }: { days: readonly ProgramDay[]; length: number }) {
  const cols = gridColumns(length)
  return (
    <ol aria-label="Program days" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 2.25}rem` }}>
      {days.map((d) => (
        <Square key={d.date} day={d} />
      ))}
    </ol>
  )
}

export function GridLegend({ strict }: { strict: boolean }) {
  const item = (swatch: string, text: string, x = false) => (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`relative size-3 ${swatch}`}>
        {x && (
          <svg viewBox="0 0 10 10" className="absolute inset-0 size-full stroke-muted" strokeWidth={1.4}>
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        )}
      </span>
      {text}
    </li>
  )
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {item('bg-accent', 'Done')}
      {item('border-2 border-accent', 'Today')}
      {item('border border-dashed border-accent', 'Yesterday, still open')}
      {!strict && item('border border-faint', 'Missed', true)}
      {item('bg-line', 'To come')}
    </ul>
  )
}
