import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Profile } from '../../lib/db'
import { formatSleep, type LinkData } from '../quests/links'
import type { StatKind } from './statsRepo'

const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

const cellClass = 'group flex min-h-touch min-w-0 flex-col justify-center px-3 py-2 text-left hover:bg-bg'

function Cell({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <>
      <span className="label group-hover:text-accent">{label}</span>
      <span className="font-display text-xl font-bold leading-tight tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted">{sub}</span>
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
      <button type="button" className={cellClass} onClick={() => onStat('steps')} aria-label={`Steps: ${num.format(data?.steps ?? 0)}. Log steps`}>
        <Cell label="Steps" value={data?.steps === undefined ? '–' : num.format(data.steps)} sub={goals.steps ? `of ${num.format(goals.steps)}` : 'tap to log'} />
      </button>
      <button
        type="button"
        className={cellClass}
        onClick={() => onStat('sleep')}
        aria-label={`Sleep: ${data?.sleepMinutes === undefined ? 'not logged' : formatSleep(data.sleepMinutes)}. Log sleep`}
      >
        <Cell
          label="Sleep"
          value={data?.sleepMinutes === undefined ? '–' : formatSleep(data.sleepMinutes)}
          sub={goals.sleepHours ? `of ${goals.sleepHours} h` : 'tap to log'}
        />
      </button>
      <Link to={foodLink} className={cellClass} aria-label={`Calories: ${num.format(data?.kcal ?? 0)}${goals.kcal ? ` of ${num.format(goals.kcal)}` : ''}. Open Food`}>
        <Cell label="Kcal" value={num.format(data?.kcal ?? 0)} sub={goals.kcal ? `of ${num.format(goals.kcal)}` : 'no target'} />
      </Link>
      <Link to={foodLink} className={cellClass} aria-label={`Protein: ${num.format(data?.proteinG ?? 0)} g${goals.proteinG ? ` of ${num.format(goals.proteinG)} g` : ''}. Open Food`}>
        <Cell label="Protein" value={`${num.format(data?.proteinG ?? 0)}g`} sub={goals.proteinG ? `of ${num.format(goals.proteinG)} g` : 'no target'} />
      </Link>
    </section>
  )
}
