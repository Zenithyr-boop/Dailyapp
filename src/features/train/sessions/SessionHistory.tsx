import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { ChevronRightIcon } from '../../../components/icons'
import { Panel } from '../../../components/Panel'
import { fromDayKey } from '../../../lib/day'
import { useUnits } from '../../profile/units'
import { TRACKING } from '../library/trackingTypes'
import { formatClock, sessionTotals } from './records'
import { listSessions } from './sessionsRepo'
import { displayWeight, unitLabel } from './weights'

const PAGE = 10
const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** Past sessions on the Train tab, newest first. */
export function SessionHistory() {
  const sessions = useLiveQuery(listSessions, [])
  const finished = useMemo(() => sessions?.filter((s) => s.finishedAt) ?? [], [sessions])
  const units = useUnits()
  const [shown, setShown] = useState(PAGE)
  if (!sessions) return null

  return (
    <Panel title="History" aside={finished.length ? String(finished.length) : undefined}>
      {finished.length === 0 ? (
        <p className="text-muted">No sessions yet. Start one from a workout above.</p>
      ) : (
        <>
          <ul className="-mx-4 -my-4">
            {finished.slice(0, shown).map((s) => {
              // Custom movements count as weighted here; close enough for a list total.
              const totals = sessionTotals(s, (id) => TRACKING[id] ?? 'weight_reps')
              return (
                <li key={s.id} className="border-b border-line-soft last:border-b-0">
                  <Link to={`/train/sessions/${encodeURIComponent(s.id)}`} className="group flex min-h-touch items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold group-hover:text-accent">{s.name}</span>
                        <span className="shrink-0 text-sm text-muted">{dateLabel.format(fromDayKey(s.date))}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted">
                        {formatClock(totals.duration)} · {totals.setsDone} set{totals.setsDone === 1 ? '' : 's'}
                        {totals.volumeKg > 0 && ` · ${Math.round(displayWeight(totals.volumeKg, units)).toLocaleString()} ${unitLabel(units)}`}
                      </span>
                    </span>
                    <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
                  </Link>
                </li>
              )
            })}
          </ul>
          {finished.length > shown && (
            <Button variant="secondary" className="mt-6 w-full" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, finished.length - shown)} more
            </Button>
          )}
        </>
      )}
    </Panel>
  )
}
