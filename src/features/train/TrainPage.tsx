import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { ComingSoon } from '../../components/ComingSoon'
import { DateSwitcher } from '../../components/DateSwitcher'
import { ChevronRightIcon, PlayIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { canEditQuests, clampDay, dayLabel, longDayLabel, useToday } from '../../lib/day'
import { WorkoutsSection } from './workouts/WorkoutsSection'
import { ResumeBanner } from './sessions/ResumeBanner'
import { SessionHistory } from './sessions/SessionHistory'
import { listSessions } from './sessions/sessionsRepo'
import { useStartSession } from './sessions/useStartSession'

export function TrainPage() {
  const today = useToday()
  const [params] = useSearchParams()
  const date = clampDay(params.get('date'), today)
  const past = date !== today

  return (
    <>
      <PageHeader title="Train" kicker={longDayLabel(date)} aside={<DateSwitcher date={date} today={today} />} />
      <div className="space-y-4">
        <ResumeBanner />
        {past && <DayWorkouts date={date} today={today} />}
        <WorkoutsSection date={past ? date : undefined} />
        <SessionHistory />
        <Panel title="Library">
          <Link to="/train/movements" className="group -my-2 flex min-h-touch items-center gap-3 py-2">
            <span className="flex-1">
              <span className="block font-display text-lg font-semibold uppercase tracking-wider group-hover:text-accent">
                Movement library
              </span>
              <span className="block text-sm text-muted">870+ movements with photos and instructions, plus your own</span>
            </span>
            <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
          </Link>
        </Panel>
        <ComingSoon
          items={['Programs that schedule your workouts week by week']}
        />
      </div>
    </>
  )
}

/** An earlier day: the workouts logged that day, and logging one for it. */
function DayWorkouts({ date, today }: { date: string; today: string }) {
  const sessions = useLiveQuery(async () => (await listSessions()).filter((s) => s.finishedAt && s.date === date), [date])
  const { start, busy, dialog } = useStartSession()
  const label = dayLabel(date, today)

  return (
    <Panel title={`Workouts · ${label}`}>
      {sessions && sessions.length === 0 && <p className="text-muted">No workout logged this day.</p>}
      {sessions && sessions.length > 0 && (
        <ul className="-mx-4 -mt-4 mb-4 border-b border-line-soft">
          {sessions.map((s) => (
            <li key={s.id} className="border-b border-line-soft last:border-b-0">
              <Link to={`/train/sessions/${encodeURIComponent(s.id)}`} className="group flex min-h-touch items-center gap-3 px-4 py-2">
                <span className="flex-1 font-semibold group-hover:text-accent">{s.name}</span>
                <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-4 w-full" onClick={() => start(undefined, date)} disabled={busy}>
        <PlayIcon size={18} />
        Log a workout for {label}
      </Button>
      <p className="mt-2 text-sm text-muted">
        {canEditQuests(date, today)
          ? 'Finishing it ticks that day’s Train quest.'
          : 'Quests only change today and yesterday, so this adds no XP.'}{' '}
        Workouts started below are logged for {label} too.
      </p>
      {dialog}
    </Panel>
  )
}
