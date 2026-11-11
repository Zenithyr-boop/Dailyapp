import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { useOverlay } from '../../components/useOverlay'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { PlusIcon } from '../../components/icons'
import { db, type Day } from '../../lib/db'
import { clampDay, dayLabel, fromDayKey, isDayKey, longDayLabel, useToday } from '../../lib/day'
import type { UnitSystem } from '../../lib/units'
import { useProfile } from '../profile/goals/goalsRepo'
import { inputClass, NumberField } from '../train/workouts/fields'
import { measurePoints, saveWeight, setGoalWeight, useBodyDays, weightPoints, type BodyPoint } from './bodyRepo'
import { TrendChart } from './chart/TrendChart'
import {
  estimateGoal,
  isRangeId,
  movingAverage,
  rangeStart,
  RANGES,
  signed,
  trendWeight,
  weeklyRate,
  type GoalEstimate,
  type RangeId,
} from './trend'
import { NavRow, PhotoPrivacyNote, Segmented } from './ui'
import { submitOnEnter } from './forms'
import { fmt1, fromShownWeight, lengthUnitOf, MEASURES, showCm, showKg, WEIGHT_LIMITS, weightUnit } from './units'

const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Body: a fast daily weigh-in, the weight trend, and links to measurements and photos. */
export function BodyPage() {
  const today = useToday()
  const profile = useProfile()
  const days = useBodyDays()
  const overlay = useOverlay()
  const [, setParams] = useSearchParams()
  const rangeParam = overlay.params.get('range')
  const range: RangeId = isRangeId(rangeParam) ? rangeParam : '3m'
  const weigh = overlay.params.get('weigh')
  const units = profile?.units ?? 'metric'

  const weights = useMemo(() => (days ? weightPoints(days) : []), [days])
  const todayWeight = weights.at(-1)?.date === today ? weights.at(-1)!.value : undefined

  function setRange(next: RangeId) {
    const p = new URLSearchParams(overlay.params)
    if (next === '3m') p.delete('range')
    else p.set('range', next)
    setParams(p, { replace: true, preventScrollReset: true })
  }

  return (
    <>
      <PageHeader title="Body" kicker={longDayLabel(today)} />
      {!days || !profile ? (
        <p className="text-muted" role="status">
          Loading…
        </p>
      ) : (
        <div className="space-y-4">
          <WeighInPanel key={today} today={today} todayWeight={todayWeight} lastWeight={weights.at(-1)?.value} units={units} />
          <TrendPanel
            weights={weights}
            today={today}
            units={units}
            goal={profile.goalWeightKg}
            range={range}
            onRange={setRange}
            onGoal={() => overlay.open('goal')}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <WeighInList weights={weights} today={today} units={units} onOpen={(date) => overlay.open('weigh', date)} />
            <div className="space-y-4">
              <MeasurementsSummary days={days} lengthUnit={lengthUnitOf(profile)} />
              <PhotosSummary />
            </div>
          </div>
        </div>
      )}

      {weigh && days && (
        <WeighInDialog
          param={weigh}
          today={today}
          days={days}
          units={units}
          onClose={() => overlay.close('weigh')}
        />
      )}
      {overlay.params.get('goal') === '1' && profile && (
        <GoalDialog goal={profile.goalWeightKg} current={trendWeight(weights)} units={units} onClose={() => overlay.close('goal')} />
      )}
    </>
  )
}

function WeightField({
  id,
  value,
  onChange,
  units,
  placeholder,
}: {
  id: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  units: UnitSystem
  placeholder?: number
}) {
  const { min, max } = WEIGHT_LIMITS[units]
  return (
    <div className="flex items-center gap-2">
      <NumberField
        id={id}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        precision={1}
        optional
        placeholder={placeholder !== undefined ? fmt1(placeholder) : units === 'metric' ? '75.0' : '165.0'}
        className="max-w-36 text-2xl"
      />
      <span className="label">{weightUnit(units)}</span>
    </div>
  )
}

/** Today's weigh-in: one field and Save. */
function WeighInPanel({
  today,
  todayWeight,
  lastWeight,
  units,
}: {
  today: string
  todayWeight: number | undefined
  lastWeight: number | undefined
  units: UnitSystem
}) {
  const id = useId()
  const saved = todayWeight === undefined ? undefined : showKg(todayWeight, units)
  const [value, setValue] = useState(saved)
  const [shownSaved, setShownSaved] = useState(saved)
  if (saved !== shownSaved) {
    // Logged from elsewhere (another device, the list below): show it.
    setShownSaved(saved)
    setValue(saved)
  }
  const [status, setStatus] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (value === undefined) return
    await saveWeight(today, fromShownWeight(value, units))
    setStatus(`Saved ${fmt1(value)} ${weightUnit(units)} for today.`)
  }

  return (
    <Panel title="Today’s weigh-in" aside={saved !== undefined ? 'Logged' : undefined}>
      <form onSubmit={(e) => void submit(e)} onKeyDown={submitOnEnter} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={id} className="label block">
            Weight
          </label>
          <div className="mt-1">
            <WeightField
              id={id}
              value={value}
              onChange={setValue}
              units={units}
              placeholder={lastWeight !== undefined ? showKg(lastWeight, units) : undefined}
            />
          </div>
        </div>
        <Button type="submit" disabled={value === undefined || value === saved}>
          {saved !== undefined && value === saved ? 'Saved' : 'Save'}
        </Button>
      </form>
      <p role="status" className={status ? 'mt-2 text-sm' : 'sr-only'}>
        {status}
      </p>
      {!status && <p className="mt-2 text-sm text-muted">Same time each day works best: morning, after the bathroom, before food.</p>}
    </Panel>
  )
}

function estimateText(e: GoalEstimate, rate: number | undefined): string {
  switch (e.kind) {
    case 'no-goal':
      return 'Set a goal weight to see when you could reach it.'
    case 'no-data':
      return 'Log a weigh-in to start.'
    case 'reached':
      return 'You’re at your goal weight.'
    case 'need-rate':
      return 'Log at least 4 weigh-ins over a week for an estimate.'
    case 'not-heading':
      return rate !== undefined && Math.abs(rate) < 0.05
        ? 'Holding steady, so no estimate at this rate.'
        : 'Moving away from your goal right now, so no estimate.'
    case 'too-far':
      return 'More than 2 years away at this rate.'
    case 'date': {
      const weeks = Math.round(e.days / 7)
      return `Around ${longDate.format(fromDayKey(e.date))} (${weeks <= 1 ? `${e.days} days` : `${weeks} weeks`}) at this rate.`
    }
  }
}

function TrendPanel({
  weights,
  today,
  units,
  goal,
  range,
  onRange,
  onGoal,
}: {
  weights: BodyPoint[]
  today: string
  units: UnitSystem
  goal: number | undefined
  range: RangeId
  onRange: (r: RangeId) => void
  onGoal: () => void
}) {
  const unit = weightUnit(units)
  const trend = trendWeight(weights)
  const rate = weeklyRate(weights, today)
  const estimate = estimateGoal({ current: trend, goal, rate, today })

  const chart = useMemo(() => {
    const avg = movingAverage(weights)
    const from = rangeStart(range, today)
    const idx = weights.map((_, i) => i).filter((i) => !from || weights[i]!.date >= from)
    return {
      dates: idx.map((i) => weights[i]!.date),
      series: [
        { label: 'Weight', style: 'dots' as const, values: idx.map((i) => showKg(weights[i]!.value, units)) },
        { label: '7-day avg', style: 'line' as const, values: idx.map((i) => showKg(avg[i]!, units)) },
      ],
    }
  }, [weights, range, today, units])

  return (
    <Panel title="Weight trend">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Stat label="Trend (7-day avg)" value={trend === undefined ? '–' : fmt1(showKg(trend, units))} unit={trend === undefined ? undefined : unit} />
        <Stat
          label="Per week"
          value={rate === undefined ? '–' : signed(units === 'metric' ? rate : showKg(rate, units), units === 'metric' ? 2 : 1)}
          unit={rate === undefined ? undefined : unit}
        />
        <div>
          <dt className="label">Goal</dt>
          <dd className="mt-0.5">
            <button
              type="button"
              onClick={onGoal}
              className="-my-1 min-h-touch text-left font-display text-3xl font-bold tabular-nums leading-none hover:text-accent"
              aria-label={goal === undefined ? 'Set a goal weight' : `Goal weight ${fmt1(showKg(goal, units))} ${unit}. Change`}
            >
              {goal === undefined ? (
                <span className="text-base uppercase tracking-wider text-accent">Set goal</span>
              ) : (
                <>
                  {fmt1(showKg(goal, units))}
                  <span className="ml-1 text-base font-semibold text-muted">{unit}</span>
                </>
              )}
            </button>
          </dd>
        </div>
        <div>
          <dt className="label">To goal</dt>
          <dd className="mt-0.5 font-display text-3xl font-bold tabular-nums leading-none">
            {goal !== undefined && trend !== undefined ? signed(showKg(goal, units) - showKg(trend, units)) : '–'}
            {goal !== undefined && trend !== undefined && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
          </dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-line-soft pt-3 text-sm" aria-live="polite">
        <span className="label mr-2">Estimate</span>
        {estimateText(estimate, rate)}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-4 text-sm text-muted" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
              <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Weigh-ins
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-accent" />
            7-day average
          </span>
        </p>
        <div className="w-full sm:w-auto">
          <Segmented label="Chart range" options={RANGES} value={range} onChange={onRange} />
        </div>
      </div>
      <div className="mt-3">
        {weights.length === 0 ? (
          <p className="py-8 text-center text-muted">Your weigh-ins will show here.</p>
        ) : chart.dates.length === 0 ? (
          <p className="py-8 text-center text-muted">No weigh-ins in this range.</p>
        ) : (
          <TrendChart
            dates={chart.dates}
            series={chart.series}
            goal={goal === undefined ? undefined : showKg(goal, units)}
            height={220}
            unit={unit}
            format={fmt1}
            ariaLabel={`Weight over ${chart.dates.length} weigh-ins, with the 7-day average`}
          />
        )}
      </div>
    </Panel>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 font-display text-3xl font-bold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
      </dd>
    </div>
  )
}

const SHORT_LIST = 7

function WeighInList({
  weights,
  today,
  units,
  onOpen,
}: {
  weights: BodyPoint[]
  today: string
  units: UnitSystem
  onOpen: (date: string) => void
}) {
  const [all, setAll] = useState(false)
  const newest = [...weights].reverse()
  const shown = all ? newest : newest.slice(0, SHORT_LIST)
  const unit = weightUnit(units)
  return (
    <Panel title="Weigh-ins" aside={weights.length ? `${weights.length}` : undefined}>
      {weights.length === 0 ? (
        <p className="text-muted">Nothing logged yet.</p>
      ) : (
        <ul className="-mx-4 -mt-4">
          {shown.map((p, i) => {
            const prev = newest[i + 1]
            return (
              <li key={p.date} className="border-b border-line-soft">
                <button
                  type="button"
                  onClick={() => onOpen(p.date)}
                  className="group flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left"
                  aria-label={`${dayLabel(p.date, today)}: ${fmt1(showKg(p.value, units))} ${unit}. Edit`}
                >
                  <span className="flex-1 group-hover:text-accent">{dayLabel(p.date, today)}</span>
                  {prev && (
                    <span className="text-sm tabular-nums text-muted">
                      {signed(showKg(p.value, units) - showKg(prev.value, units))}
                    </span>
                  )}
                  <span className="w-24 text-right font-display text-lg font-bold tabular-nums">
                    {fmt1(showKg(p.value, units))} <span className="text-sm font-semibold text-muted">{unit}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onOpen('new')}>
          <PlusIcon size={18} />
          Log another day
        </Button>
        {newest.length > SHORT_LIST && (
          <Button variant="secondary" onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? 'Show fewer' : `Show all ${newest.length}`}
          </Button>
        )}
      </div>
    </Panel>
  )
}

/** Add, change or remove the weigh-in of any day up to today (`?weigh=<date>` or `?weigh=new`). */
function WeighInDialog({
  param,
  today,
  days,
  units,
  onClose,
}: {
  param: string
  today: string
  days: Day[]
  units: UnitSystem
  onClose: () => void
}) {
  const isNew = !isDayKey(param)
  const id = useId()
  const [date, setDate] = useState(() => clampDay(isNew ? today : param, today))
  const existing = days.find((d) => d.date === date)?.weightKg
  const [value, setValue] = useState(existing === undefined ? undefined : showKg(existing, units))
  const [busy, setBusy] = useState(false)

  function pickDate(next: string) {
    const d = clampDay(next, today)
    setDate(d)
    const w = days.find((x) => x.date === d)?.weightKg
    setValue(w === undefined ? undefined : showKg(w, units))
  }

  async function save(kg: number | undefined) {
    setBusy(true)
    try {
      await saveWeight(date, kg)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={isNew ? 'Log a weigh-in' : `Weigh-in · ${dayLabel(date, today)}`} onClose={onClose} busy={busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value !== undefined) void save(fromShownWeight(value, units))
        }}
        onKeyDown={submitOnEnter}
        className="space-y-4"
      >
        {isNew && (
          <div>
            <label htmlFor={`${id}-date`} className="label block">
              Day
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => e.target.value && pickDate(e.target.value)}
              className={`${inputClass} mt-1`}
            />
            {existing !== undefined && <p className="mt-1 text-sm text-muted">This day already has a weigh-in. Saving replaces it.</p>}
          </div>
        )}
        <div>
          <label htmlFor={`${id}-w`} className="label block">
            Weight
          </label>
          <div className="mt-1">
            <WeightField id={`${id}-w`} value={value} onChange={setValue} units={units} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="flex-1" disabled={busy || value === undefined}>
            Save
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
        {existing !== undefined && (
          <Button variant="secondary" className="w-full" onClick={() => void save(undefined)} disabled={busy}>
            Remove weigh-in
          </Button>
        )}
      </form>
    </Dialog>
  )
}

function GoalDialog({
  goal,
  current,
  units,
  onClose,
}: {
  goal: number | undefined
  current: number | undefined
  units: UnitSystem
  onClose: () => void
}) {
  const id = useId()
  const [value, setValue] = useState(goal === undefined ? undefined : showKg(goal, units))

  async function save(kg: number | undefined) {
    await setGoalWeight(kg)
    onClose()
  }

  return (
    <Dialog title="Goal weight" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value !== undefined) void save(fromShownWeight(value, units))
        }}
        onKeyDown={submitOnEnter}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          Your own goal. FromZero uses it to estimate when you could get there at your current rate.
        </p>
        <div>
          <label htmlFor={id} className="label block">
            Goal weight
          </label>
          <div className="mt-1">
            <WeightField id={id} value={value} onChange={setValue} units={units} placeholder={current !== undefined ? showKg(current, units) : undefined} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="flex-1" disabled={value === undefined}>
            Save
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {goal !== undefined && (
          <Button variant="secondary" className="w-full" onClick={() => void save(undefined)}>
            Remove goal
          </Button>
        )}
      </form>
    </Dialog>
  )
}

function MeasurementsSummary({ days, lengthUnit }: { days: Day[]; lengthUnit: 'cm' | 'in' }) {
  const rows = MEASURES.map((m) => {
    const pts = measurePoints(days, m.key)
    return { ...m, latest: pts.at(-1), first: pts[0] }
  })
  const last = rows.reduce<string | undefined>((max, r) => (r.latest && (!max || r.latest.date > max) ? r.latest.date : max), undefined)
  return (
    <Panel title="Measurements" aside={last ? `Last ${longDate.format(fromDayKey(last))}` : undefined}>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-5">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className="label">{r.label}</dt>
            <dd className="font-display text-xl font-bold tabular-nums leading-tight">
              {r.latest ? fmt1(showCm(r.latest.value, lengthUnit)) : '–'}
              {r.latest && r.first && r.first.date !== r.latest.date && signed(showCm(r.latest.value, lengthUnit) - showCm(r.first.value, lengthUnit)) !== '0.0' && (
                <span className="block text-xs font-semibold text-muted">
                  {signed(showCm(r.latest.value, lengthUnit) - showCm(r.first.value, lengthUnit))}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-muted">In {lengthUnit}. Change since your first measurement.</p>
      <div className="-mb-2 mt-2 border-t border-line-soft">
        <NavRow to="/body/measurements" title="Measurements" sub="Log, history and a chart for each" />
      </div>
    </Panel>
  )
}

function PhotosSummary() {
  const info = useLiveQuery(async () => {
    const count = await db.photos.count()
    const latest = await db.photos.orderBy('date').last()
    return { count, latest: latest?.date }
  }, [])
  return (
    <Panel title="Progress photos" aside={info?.count ? `${info.count} on this device` : undefined}>
      <PhotoPrivacyNote compact />
      <div className="-mb-2 mt-2 border-t border-line-soft">
        <NavRow
          to="/body/photos"
          title="Photos"
          sub={info?.latest ? `Last photo ${longDate.format(fromDayKey(info.latest))}. Compare any two dates.` : 'Add your first photo, then compare any two dates'}
        />
      </div>
    </Panel>
  )
}
