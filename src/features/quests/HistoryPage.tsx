import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { ChevronLeftIcon } from '../../components/icons'
import { MonthCalendar } from '../../components/MonthCalendar'
import { useOverlay } from '../../components/useOverlay'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { db } from '../../lib/db'
import { clampDay, daysOfMonth, isDayKey, longDayLabel, monthOf, useToday } from '../../lib/day'
import { DaySummary } from './DaySummary'
import { useQuestDays } from './questDays'

const fmt = new Intl.NumberFormat()
const MONTH = /^\d{4}-\d{2}$/

/**
 * Day history (`/quests/history?month=YYYY-MM`): a month calendar where each
 * day shows how many quests were done. Tapping a day opens its summary
 * (`?day=YYYY-MM-DD`, in the URL so Back closes it).
 */
export function HistoryPage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const overlay = useOverlay()
  const rawMonth = params.get('month')
  const month = rawMonth && MONTH.test(rawMonth) && rawMonth <= monthOf(today) ? rawMonth : monthOf(today)
  const rawDay = params.get('day')
  const openDay = isDayKey(rawDay) ? clampDay(rawDay, today) : undefined
  const profile = useLiveQuery(() => db.profile.get('me'), [])
  const qd = useQuestDays(today)

  function setMonth(next: string) {
    const p = new URLSearchParams(params)
    if (next === monthOf(today)) p.delete('month')
    else p.set('month', next)
    setParams(p, { replace: true, preventScrollReset: true })
  }

  const cells = qd ? daysOfMonth(month).filter((d) => d <= today).map(qd.cell) : []
  // Today counts once it's full; until then it's still in progress, not missed.
  const counted = cells.filter((c) => c.status !== 'before-start' && (c.date < today || c.status === 'full'))
  const count = (s: string) => counted.filter((c) => c.status === s).length
  const xp = counted.reduce((sum, c) => sum + c.xp, 0)

  return (
    <>
      <Link
        to="/quests"
        className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        Quests
      </Link>
      <PageHeader title="Day history" kicker="Quests done per day" />
      {!qd || !profile ? (
        <p className="text-muted">Loading history…</p>
      ) : (
        <div className="space-y-4 md:max-w-xl">
          <Panel>
            <MonthCalendar
              month={month}
              today={today}
              selected={openDay}
              onMonthChange={setMonth}
              onPick={(date) => overlay.open('day', date)}
              dayInfo={qd.info}
            />
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 bg-accent" /> All done
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 bg-accent/35" /> Some done
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 bg-line" /> Missed
              </li>
            </ul>
          </Panel>
          <Panel title="This month">
            <dl className="grid grid-cols-4 gap-3">
              <Stat label="Full" value={count('full')} />
              <Stat label="Partial" value={count('partial')} />
              <Stat label="Missed" value={count('missed')} />
              <Stat label="XP" value={fmt.format(xp)} />
            </dl>
          </Panel>
        </div>
      )}

      {openDay && qd && profile && (
        <Dialog title={longDayLabel(openDay)} onClose={() => overlay.close('day')}>
          <DaySummary date={openDay} today={today} day={qd.byDate.get(openDay)} firstDate={qd.firstDate} profile={profile} />
          <Button variant="secondary" className="w-full" onClick={() => overlay.close('day')}>
            Close
          </Button>
        </Dialog>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl font-bold leading-none tabular-nums">{value}</dd>
    </div>
  )
}
