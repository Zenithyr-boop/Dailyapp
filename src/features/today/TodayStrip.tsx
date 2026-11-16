import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Profile } from '../../lib/db'
import { formatSleep, type LinkData } from '../quests/links'
import type { StatKind } from './statsRepo'

const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

const cellClass = 'group flex min-h-touch min-w-0 flex-col justify-center px-3 py-2 text-left hover:bg-bg'

function Cell({ label, value, sub, action }: { label: string; value: ReactNode; sub: string; action: string }) {
  const empty = value === '–'
  return (
    <>
      <span className="label group-hover:text-accent">{label}</span>
      <span className="font-display text-xl font-bold leading-tight tabular-nums">
        <span aria-hidden={empty || undefined}>{value}</span>
        {empty && <span className="sr-only">not logged</span>}
      </span>
      <span className="truncate text-xs text-muted">{sub}</span>
      <span className="sr-only">, {action}</span>
    </>
  )
}

/**
 * Compact "Today" strip above the quests: steps, sleep, calories, protein for
 * the day shown. Steps and sleep open quick entry; calories and protein open Food.
 */
export function TodayStrip({
  date,
  today,
  data,
  goals,
  onStat,
}: {
  date: string
  today: string
  data: LinkData | undefined
  goals: Profile['goals']
  onStat: (stat: StatKind) => void
}) {
  const foodLink = date === today ? '/food' : `/food?date=${date}`
  return (
    <section aria-label={date === today ? 'Today' : 'This day'} className="grid grid-cols-4 divide-x divide-line-soft border border-panel-edge bg-panel">
      <button type="button" className={cellClass} onClick={() => onStat('steps')}>
        <Cell action="log steps" label="Steps" value={data?.steps === undefined ? '–' : num.format(data.steps)} sub={goals.steps ? `of ${num.format(goals.steps)}` : 'tap to log'} />
      </button>
      <button
        type="button"
        className={cellClass}
        onClick={() => onStat('sleep')}
      >
        <Cell
          action="log sleep"
          label="Sleep"
          value={data?.sleepMinutes === undefined ? '–' : formatSleep(data.sleepMinutes)}
          sub={goals.sleepHours ? `of ${goals.sleepHours} h` : 'tap to log'}
        />
      </button>
      <Link to={foodLink} className={cellClass}>
        <Cell action="open Food" label="Kcal" value={num.format(data?.kcal ?? 0)} sub={goals.kcal ? `of ${num.format(goals.kcal)}` : 'no target'} />
      </Link>
      <Link to={foodLink} className={cellClass}>
        <Cell action="open Food" label="Protein" value={`${num.format(data?.proteinG ?? 0)}g`} sub={goals.proteinG ? `of ${num.format(goals.proteinG)} g` : 'no target'} />
      </Link>
    </section>
  )
}
