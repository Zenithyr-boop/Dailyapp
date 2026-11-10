import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { ChevronLeftIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { StatBlock } from '../../../components/StatBlock'
import { fromDayKey } from '../../../lib/dates'
import { useUnits } from '../../profile/units'
import type { TrackingType } from '../library/types'
import { useMovements } from '../library/useMovements'
import { progressionHint } from './progression'
import { formatClock, formatRecord, formatSets, sessionRecords, sessionTotals } from './records'
import { deleteSession, getSession, listSessions, type TrainQuestResult } from './sessionsRepo'
import { displayWeight, formatNumber, formatWeight, unitLabel } from './weights'

const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const timeLabel = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

const TRAIN_NOTES: Record<TrainQuestResult, string> = {
  checked: 'Train quest done: its XP is added to today.',
  already: 'Train quest was already done today.',
  missing: 'No “Train” quest today, so no XP was added. Add one in Edit quests.',
}

/** A finished session: totals, new records, next-time hints and every set. Shown right after Finish too. */
export function SessionSummaryPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = useLiveQuery(async () => (await getSession(id)) ?? null, [id])
  const all = useLiveQuery(listSessions, [])
  const { movements } = useMovements()
  const byId = useMemo(() => new Map(movements?.map((m) => [m.id, m])), [movements])
  const units = useUnits()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const justFinished = params.get('done') === '1'
  const train = params.get('train') as TrainQuestResult | null

  if (session === undefined || !all) return <p className="text-muted">Loading session…</p>
  if (session === null) {
    return (
      <>
        <BackLink />
        <PageHeader title="Session not found" />
        <Panel title="Session">
          <p className="text-muted">This session was deleted, maybe on another device.</p>
        </Panel>
      </>
    )
  }
  if (!session.finishedAt) return <Navigate to="/train/session" replace />

  const trackingOf = (mid: string): TrackingType => byId.get(mid)?.tracking ?? 'weight_reps'
  const totals = sessionTotals(session, trackingOf)
  const records = movements ? sessionRecords(session, all, trackingOf) : []
  const nameOf = (mid: string) => byId.get(mid)?.name ?? 'Unknown movement'
  const volume = displayWeight(totals.volumeKg, units)

  return (
    <>
      <BackLink />
      <PageHeader
        title={session.name}
        kicker={
          justFinished
            ? 'Session complete'
            : `${dateLabel.format(fromDayKey(session.date))} · ${timeLabel.format(new Date(session.startedAt))}`
        }
      />

      <div className="space-y-4">
        <Panel title="Summary">
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Duration" value={formatClock(totals.duration)} />
            <StatBlock label="Volume" value={Math.round(volume).toLocaleString()} unit={unitLabel(units)} />
            <StatBlock label="Sets" value={totals.setsDone} />
          </div>
          {justFinished && train && TRAIN_NOTES[train] && <p className="mt-3 text-sm text-muted">{TRAIN_NOTES[train]}</p>}
        </Panel>

        <Panel title="Personal records" aside={records.length ? String(records.length) : undefined}>
          {records.length === 0 ? (
            <p className="text-muted">No new records this time. Records count once a movement has been logged before.</p>
          ) : (
            <ul className="-my-2">
              {records.map((r) => (
                <li key={`${r.movementId}-${r.kind}`} className="border-b border-line-soft py-2 last:border-b-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="border border-accent px-1.5 font-display text-xs font-bold uppercase tracking-wider text-accent">PR</span>
                    {nameOf(r.movementId)}
                  </p>
                  <p className="text-sm text-muted">{formatRecord(r, units)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Next time">
          <ul className="-my-2">
            {session.exercises.map((ex) => {
              const movement = byId.get(ex.movementId)
              const hint = movement && progressionHint(ex, movement)
              let text: string
              if (!hint) text = 'Repeat or adjust as it felt.'
              else if (hint.action === 'increase') {
                text = `Go up to ${formatWeight(hint.toKg, units)} (+${formatNumber(displayWeight(hint.byKg, units))} ${unitLabel(units)}): every set hit the top of the range.`
              } else text = `Stay at ${formatWeight(hint.kg, units)}: ${hint.reason}.`
              return (
                <li key={ex.key} className="border-b border-line-soft py-2 last:border-b-0">
                  <p className="font-semibold">{nameOf(ex.movementId)}</p>
                  <p className={`text-sm ${hint?.action === 'increase' ? 'text-accent' : 'text-muted'}`}>{text}</p>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Sets">
          <ul className="-my-2">
            {session.exercises.map((ex) => (
              <li key={ex.key} className="border-b border-line-soft py-2 last:border-b-0">
                <Link to={`/train/movements/${encodeURIComponent(ex.movementId)}`} className="font-semibold hover:text-accent">
                  {nameOf(ex.movementId)}
                </Link>
                <p className="text-sm text-muted">{formatSets(ex.sets, trackingOf(ex.movementId), units)}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => navigate('/train')}>
            Done
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            Delete session
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <Dialog title="Delete session?" onClose={() => setConfirmDelete(false)}>
          <p>It’s removed from your history on all your devices. The Train quest stays ticked.</p>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await deleteSession(session.id)
                navigate('/train', { replace: true })
              }}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function BackLink() {
  return (
    <Link
      to="/train"
      className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
    >
      <ChevronLeftIcon size={18} />
      Train
    </Link>
  )
}
