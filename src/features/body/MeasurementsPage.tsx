import { useId, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { DateSwitcher } from '../../components/DateSwitcher'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import type { MeasureKey, Measurements } from '../../lib/db'
import { clampDay, dayLabel, fromDayKey, longDayLabel, useToday } from '../../lib/day'
import { useProfile } from '../profile/goals/goalsRepo'
import { NumberField } from '../train/workouts/fields'
import { measurePoints, saveBody, useBodyDays, type BodyChanges } from './bodyRepo'
import { TrendChart } from './chart/TrendChart'
import { signed } from './trend'
import { BackLink, Segmented } from './ui'
import { submitOnEnter } from './forms'
import { fmt1, fromShownLength, isMeasureKey, LENGTH_LIMITS, lengthUnitOf, MEASURES, measureLabel, showCm, type LengthUnit } from './units'

/**
 * Measurements: log any of the five for a day (`?date=`, shared date
 * switcher), and a chart + history for one at a time (`?m=waistCm`).
 */
export function MeasurementsPage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const date = clampDay(params.get('date'), today)
  const mParam = params.get('m')
  const selected: MeasureKey = isMeasureKey(mParam) ? mParam : 'waistCm'
  const profile = useProfile()
  const days = useBodyDays()

  function select(m: MeasureKey) {
    const p = new URLSearchParams(params)
    p.set('m', m)
    setParams(p, { replace: true, preventScrollReset: true })
  }

  function editDay(d: string) {
    const p = new URLSearchParams(params)
    if (d === today) p.delete('date')
    else p.set('date', d)
    setParams(p, { preventScrollReset: true })
    document.getElementById('log-measurements')?.scrollIntoView({ block: 'start' })
  }

  if (!days || !profile) {
    return (
      <p className="text-muted" role="status">
        Loading…
      </p>
    )
  }
  const unit = lengthUnitOf(profile)
  const current = days.find((d) => d.date === date)?.measurements ?? {}

  return (
    <>
      <BackLink to="/body">Body</BackLink>
      <PageHeader title="Measurements" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <section id="log-measurements" aria-labelledby="log-title" className="scroll-mt-4 border border-panel-edge bg-panel">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-2">
            <h2 id="log-title" className="label">
              Log · {longDayLabel(date)}
            </h2>
            <DateSwitcher date={date} today={today} />
          </header>
          <div className="p-4">
            <LogForm key={`${date}-${unit}`} date={date} today={today} current={current} unit={unit} />
          </div>
        </section>
        <HistoryPanel days={days} selected={selected} onSelect={select} unit={unit} today={today} onEdit={editDay} />
      </div>
    </>
  )
}

function LogForm({ date, today, current, unit }: { date: string; today: string; current: Measurements; unit: LengthUnit }) {
  const id = useId()
  const initial = useMemo(
    () => Object.fromEntries(MEASURES.map((m) => [m.key, current[m.key] === undefined ? undefined : showCm(current[m.key]!, unit)])),
    [current, unit],
  ) as Partial<Record<MeasureKey, number>>
  const [draft, setDraft] = useState(initial)
  const [shown, setShown] = useState(initial)
  if (JSON.stringify(shown) !== JSON.stringify(initial)) {
    // Saved here or changed elsewhere (sync): the form follows the stored values.
    setShown(initial)
    setDraft(initial)
  }
  const [status, setStatus] = useState('')
  const changed = MEASURES.filter((m) => draft[m.key] !== initial[m.key])
  const { min, max } = LENGTH_LIMITS[unit]

  async function submit(e: FormEvent) {
    e.preventDefault()
    const changes: BodyChanges = {}
    for (const m of changed) {
      const v = draft[m.key]
      changes[m.key] = v === undefined ? undefined : fromShownLength(v, unit)
    }
    await saveBody(date, changes)
    setStatus(`Saved for ${date === today ? 'today' : dayLabel(date, today)}.`)
  }

  return (
    <form onSubmit={(e) => void submit(e)} onKeyDown={submitOnEnter}>
      <p className="mb-3 text-sm text-muted">Each one is optional. Leave any blank. Clearing a box removes that measurement.</p>
      <div className="space-y-3">
        {MEASURES.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-${m.key}`} className="font-display text-lg font-semibold uppercase tracking-wider">
                {m.label}
              </label>
              <p id={`${id}-${m.key}-hint`} className="text-xs text-muted">
                {m.hint}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="w-24">
              <NumberField
                id={`${id}-${m.key}`}
                value={draft[m.key]}
                onChange={(v) => setDraft((d) => ({ ...d, [m.key]: v }))}
                min={min}
                max={max}
                precision={1}
                optional
                placeholder="–"
                aria-describedby={`${id}-${m.key}-hint`}
              />
              </div>
              <span className="label w-6">{unit}</span>
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" className="mt-4 w-full" disabled={changed.length === 0}>
        Save
      </Button>
      <p role="status" className={status && changed.length === 0 ? 'mt-2 text-sm' : 'sr-only'}>
        {changed.length === 0 ? status : ''}
      </p>
    </form>
  )
}

const listDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function HistoryPanel({
  days,
  selected,
  onSelect,
  unit,
  today,
  onEdit,
}: {
  days: Parameters<typeof measurePoints>[0]
  selected: MeasureKey
  onSelect: (m: MeasureKey) => void
  unit: LengthUnit
  today: string
  onEdit: (date: string) => void
}) {
  const points = useMemo(() => measurePoints(days, selected), [days, selected])
  const chart = useMemo(
    () => ({
      dates: points.map((p) => p.date),
      series: [{ label: measureLabel(selected), style: 'line-dots' as const, values: points.map((p) => showCm(p.value, unit)) }],
    }),
    [points, selected, unit],
  )
  const newest = [...points].reverse()
  const first = points[0]
  const latest = points.at(-1)

  return (
    <Panel title="History">
      <Segmented
        label="Measurement"
        options={MEASURES.map((m) => ({ id: m.key, label: m.label }))}
        value={selected}
        onChange={onSelect}
      />
      {points.length === 0 ? (
        <p className="py-8 text-center text-muted">No {measureLabel(selected).toLowerCase()} measurements yet.</p>
      ) : (
        <>
          {first && latest && first.date !== latest.date && (
            <p className="mt-4 text-sm">
              <span className="label mr-2">Since {listDate.format(fromDayKey(first.date))}</span>
              <span className="font-display text-lg font-bold tabular-nums">
                {signed(showCm(latest.value, unit) - showCm(first.value, unit))} {unit}
              </span>
            </p>
          )}
          <div className="mt-3">
            <TrendChart
              dates={chart.dates}
              series={chart.series}
              height={180}
              unit={unit}
              format={fmt1}
              ariaLabel={`${measureLabel(selected)} over ${points.length} measurements`}
            />
          </div>
          <ul className="-mx-4 -mb-4 mt-2 border-t border-line-soft">
            {newest.map((p, i) => {
              const prev = newest[i + 1]
              return (
                <li key={p.date} className="border-b border-line-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onEdit(p.date)}
                    className="group flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left"
                    aria-label={`${dayLabel(p.date, today)}: ${fmt1(showCm(p.value, unit))} ${unit}. Edit this day`}
                  >
                    <span className="flex-1 group-hover:text-accent">{dayLabel(p.date, today)}</span>
                    {prev && <span className="text-sm tabular-nums text-muted">{signed(showCm(p.value, unit) - showCm(prev.value, unit))}</span>}
                    <span className="w-24 text-right font-display text-lg font-bold tabular-nums">
                      {fmt1(showCm(p.value, unit))} <span className="text-sm font-semibold text-muted">{unit}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}
