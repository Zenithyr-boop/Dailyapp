import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Panel } from '../../../components/Panel'
import { StatBlock } from '../../../components/StatBlock'
import { fromDayKey } from '../../../lib/dates'
import { useUnits } from '../../profile/units'
import type { Movement } from '../library/types'
import { formatSeconds } from '../workouts/targets'
import { E1rmChart } from './E1rmChart'
import { bestsOf, e1rmHistory, formatSets, sessionsWith, setsFor } from './records'
import { listSessions } from './sessionsRepo'
import { displayWeight, formatNumber, unitLabel } from './weights'

const RECENT = 8
const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** "Your history" on a movement's page: bests, the estimated-1RM chart and recent sessions. */
export function MovementHistory({ movement }: { movement: Movement }) {
  const sessions = useLiveQuery(listSessions, [])
  const units = useUnits()
  if (!sessions) return null

  const logged = sessionsWith(sessions, movement.id)
  if (!logged.length) {
    return (
      <Panel title="Your history">
        <p className="text-muted">
          Nothing logged yet. Once you log this movement in a workout, your sets and personal records show up here.
        </p>
      </Panel>
    )
  }

  const bests = bestsOf(logged.flatMap((s) => setsFor(s, movement.id)))
  const unit = unitLabel(units)
  const w = (kg: number) => formatNumber(displayWeight(kg, units))
  const chart = e1rmHistory(sessions, movement.id)

  return (
    <Panel title="Your history" aside={`${logged.length} session${logged.length === 1 ? '' : 's'}`}>
      <div className="grid grid-cols-3 gap-3">
        {movement.tracking === 'weight_reps' ? (
          <>
            <StatBlock label="Heaviest" value={w(bests.heaviest)} unit={unit} />
            <StatBlock label="Est. 1RM" value={w(bests.e1rm)} unit={unit} />
            <StatBlock label="Most reps" value={bests.mostReps} />
          </>
        ) : movement.tracking === 'time' ? (
          <StatBlock label="Longest" value={formatSeconds(bests.longest)} />
        ) : movement.tracking === 'distance_time' ? (
          <StatBlock label="Farthest" value={bests.farthest} unit="m" />
        ) : (
          <StatBlock label="Most reps" value={bests.mostReps} />
        )}
      </div>

      {movement.tracking === 'weight_reps' && chart.length > 1 && (
        <div className="mt-5">
          <h3 className="label mb-2">Estimated 1RM (best set per session)</h3>
          <E1rmChart points={chart} units={units} />
        </div>
      )}

      <h3 className="label mt-5 mb-1">Recent sessions</h3>
      <ul className="-mx-4 -mb-4">
        {logged.slice(0, RECENT).map((s) => (
          <li key={s.id} className="border-t border-line-soft">
            <Link to={`/train/sessions/${encodeURIComponent(s.id)}`} className="group block min-h-touch px-4 py-2.5">
              <span className="flex justify-between gap-2">
                <span className="font-semibold group-hover:text-accent">{dateLabel.format(fromDayKey(s.date))}</span>
                <span className="truncate text-sm text-muted">{s.name}</span>
              </span>
              <span className="block text-sm text-muted">{formatSets(setsFor(s, movement.id), movement.tracking, units)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
