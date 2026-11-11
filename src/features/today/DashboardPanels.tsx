/** Desktop dashboard panels beside the daily quests: training volume, today's food, weight trend. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Panel } from '../../components/Panel'
import { db, type Profile } from '../../lib/db'
import { addDays, daysBetween } from '../../lib/day'
import type { UnitSystem } from '../../lib/units'
import { useBodyDays, weightPoints } from '../body/bodyRepo'
import { TrendChart } from '../body/chart/TrendChart'
import { movingAverage, signed, trendWeight, weeklyRate } from '../body/trend'
import { fmt1, showKg, weightUnit } from '../body/units'
import { CalorieBar, MacroBar } from '../food/ui/TotalsBars'
import { sumTotals } from '../food/nutrition'
import { TRACKING } from '../train/library/trackingTypes'
import { sessionTotals } from '../train/sessions/records'
import { displayWeight, unitLabel } from '../train/sessions/weights'
import { volumeByDay, weekStart } from './week'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

const asideLink = 'font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent'

/** Volume (Σ kg × reps) per day this week as flat bars, against last week. */
export function VolumePanel({ today, units }: { today: string; units: UnitSystem }) {
  const monday = weekStart(today)
  const lastMonday = addDays(monday, -7)
  const sessions = useLiveQuery(
    () =>
      db.sessions
        .where('date')
        .between(lastMonday, addDays(monday, 6), true, true)
        .filter((s) => !s.deleted && s.finishedAt !== undefined)
        .toArray(),
    [lastMonday, monday],
  )
  const week = useMemo(() => {
    const withVolume = (sessions ?? []).map((s) => ({ date: s.date, volumeKg: sessionTotals(s, (id) => TRACKING[id] ?? 'weight_reps').volumeKg }))
    const days = volumeByDay(withVolume, monday)
    const last = volumeByDay(withVolume, lastMonday).reduce((a, b) => a + b, 0)
    const count = withVolume.filter((s) => s.date >= monday).length
    return { days, total: days.reduce((a, b) => a + b, 0), last, count }
  }, [sessions, monday, lastMonday])
  const unit = unitLabel(units)
  const max = Math.max(...week.days, 1)
  const todayIdx = daysBetween(monday, today)
  const change = week.last > 0 ? Math.round(((week.total - week.last) / week.last) * 100) : undefined

  return (
    <Panel
      title="Volume this week"
      aside={
        <Link to="/train" className={asideLink}>
          Train
        </Link>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-bold leading-none tabular-nums">
          {num.format(displayWeight(week.total, units))}
          <span className="ml-1 text-base font-semibold text-muted">{unit}</span>
        </p>
        <p className="text-right text-sm text-muted">
          {week.count === 1 ? '1 session' : `${week.count} sessions`}
          {change !== undefined && <span className="block">{change >= 0 ? '+' : '−'}{Math.abs(change)}% vs last week</span>}
        </p>
      </div>
      <ul className="mt-4 grid h-24 grid-cols-7 items-end gap-1.5" aria-label="Volume by day">
        {week.days.map((v, i) => (
          <li key={i} className="flex h-full flex-col justify-end" aria-label={`${DAY_NAMES[i]}: ${num.format(displayWeight(v, units))} ${unit}`}>
            <div className="flex flex-1 items-end bg-line">
              <div className="w-full bg-accent" style={{ height: `${(v / max) * 100}%` }} />
            </div>
            <span className={`mt-1 text-center font-display text-xs font-semibold ${i === todayIdx ? 'text-text' : 'text-muted'}`} aria-hidden="true">
              {DAY_LETTERS[i]}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** Today's calories and macros against the targets. */
export function FoodTodayPanel({ today, goals }: { today: string; goals: Profile['goals'] }) {
  const totals = useLiveQuery(
    async () => sumTotals((await db.food.where('date').equals(today).toArray()).filter((e) => !e.deleted)),
    [today],
  )
  return (
    <Panel
      title="Today’s food"
      aside={
        <Link to="/food" className={asideLink}>
          Food
        </Link>
      }
    >
      <CalorieBar kcal={totals?.kcal ?? 0} target={goals.kcal} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MacroBar label="Protein" grams={totals?.proteinG ?? 0} target={goals.proteinG} />
        <MacroBar label="Carbs" grams={totals?.carbsG ?? 0} target={goals.carbsG} />
        <MacroBar label="Fat" grams={totals?.fatG ?? 0} target={goals.fatG} />
      </div>
    </Panel>
  )
}

/** Trend weight, weekly rate and the last 30 days as a small chart. */
export function WeightPanel({ today, units }: { today: string; units: UnitSystem }) {
  const days = useBodyDays()
  const weights = useMemo(() => (days ? weightPoints(days) : []), [days])
  const chart = useMemo(() => {
    const avg = movingAverage(weights)
    const from = addDays(today, -29)
    const idx = weights.map((_, i) => i).filter((i) => weights[i]!.date >= from)
    return {
      dates: idx.map((i) => weights[i]!.date),
      series: [
        { label: 'Weight', style: 'dots' as const, values: idx.map((i) => showKg(weights[i]!.value, units)) },
        { label: '7-day avg', style: 'line' as const, values: idx.map((i) => showKg(avg[i]!, units)) },
      ],
    }
  }, [weights, today, units])
  const trend = trendWeight(weights)
  const rate = weeklyRate(weights, today)
  const unit = weightUnit(units)

  return (
    <Panel
      title="Weight trend"
      aside={
        <Link to="/body" className={asideLink}>
          Body
        </Link>
      }
    >
      {trend === undefined ? (
        <p className="text-muted">
          No weigh-ins yet.{' '}
          <Link to="/body" className="text-accent underline underline-offset-2">
            Log one
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-3xl font-bold leading-none tabular-nums">
              {fmt1(showKg(trend, units))}
              <span className="ml-1 text-base font-semibold text-muted">{unit}</span>
            </p>
            <p className="text-right text-sm text-muted">
              {rate === undefined ? 'Rate after a week of weigh-ins' : `${signed(units === 'metric' ? rate : showKg(rate, units), units === 'metric' ? 2 : 1)} ${unit} / week`}
            </p>
          </div>
          {chart.dates.length > 0 && (
            <div className="mt-3">
              <TrendChart dates={chart.dates} series={chart.series} height={130} unit={unit} format={fmt1} ariaLabel="Weight over the last 30 days" />
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
