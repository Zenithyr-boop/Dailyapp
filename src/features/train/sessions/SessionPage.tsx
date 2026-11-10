import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { ChevronLeftIcon, PlusIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import type { LoggedSet, Session, SessionExercise } from '../../../lib/db'
import { UnitToggle } from '../../profile/UnitToggle'
import { useUnits } from '../../profile/units'
import type { TrackingType } from '../library/types'
import { useMovements } from '../library/useMovements'
import { MovementPicker } from '../workouts/MovementPicker'
import { DEFAULT_REST_SECONDS } from './constants'
import { ExerciseCard } from './ExerciseCard'
import { progressionHint } from './progression'
import { formatClock, formatSets, lastTimeSets, sessionsWith } from './records'
import { startRest, skipRest, useNow, useWakeLock } from './restTimer'
import { RestTimerBar } from './RestTimerBar'
import {
  addExercises,
  deleteSession,
  finishSession,
  getActiveSession,
  hasDoneSets,
  listSessions,
  newExercise,
  removeExercise,
  setDone,
  swapExercise,
  updateSession,
} from './sessionsRepo'
import { useStartSession } from './useStartSession'

/** Labels "A1", "A2"… for superset members (neighbours sharing a group). */
function supersetLabels(exercises: readonly SessionExercise[]): (string | undefined)[] {
  let letter = -1
  let pos = 0
  return exercises.map((e, i) => {
    if (!e.group || (exercises[i - 1]?.group !== e.group && exercises[i + 1]?.group !== e.group)) return undefined
    if (exercises[i - 1]?.group !== e.group) {
      letter++
      pos = 0
    }
    return `${String.fromCharCode(65 + (letter % 26))}${++pos}`
  })
}

/**
 * The live logger for the session in progress. Every edit is written to Dexie
 * at once; ticking a set starts the rest timer; the screen stays awake.
 */
export function SessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const session = useLiveQuery(async () => (await getActiveSession()) ?? null, [])
  const history = useLiveQuery(listSessions, [])
  const { movements, error, retry } = useMovements()
  const byId = useMemo(() => new Map(movements?.map((m) => [m.id, m])), [movements])
  const units = useUnits()
  const now = useNow(1000, !!session)
  const { start, dialog: startDialog } = useStartSession()
  const [confirm, setConfirm] = useState<'finish' | 'discard' | { remove: SessionExercise } | null>(null)
  useWakeLock(!!session)

  const trackingOf = (id: string): TrackingType => byId.get(id)?.tracking ?? 'weight_reps'
  const picker = params.get('add') === '1' ? 'add' : params.get('swap')

  if (session === undefined || !history) {
    return <p className="text-muted">Loading session…</p>
  }

  if (session === null) {
    return (
      <>
        <BackLink />
        <PageHeader title="No session" />
        <Panel title="Session">
          <p className="text-muted">No session in progress. Start one from a workout on the Train tab, or start an empty one.</p>
          <Button className="mt-4" onClick={() => start()}>
            <PlusIcon size={18} />
            Start empty session
          </Button>
        </Panel>
        {startDialog}
      </>
    )
  }

  const s = session
  const edit = (change: (x: Session) => Session) => void updateSession(s.id, change)
  const labels = supersetLabels(s.exercises)
  const done = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0)
  const total = s.exercises.reduce((n, e) => n + e.sets.length, 0)

  function tick(ex: SessionExercise, i: number, set: LoggedSet, isDone: boolean) {
    edit((x) => setDone(x, ex.key, set.key, isDone))
    if (!isDone) return
    // In a superset only the last movement of the round rests.
    const leadsOn = !!ex.group && s.exercises[i + 1]?.group === ex.group
    if (leadsOn) return void skipRest()
    void startRest(ex.target?.restSec ?? DEFAULT_REST_SECONDS, byId.get(ex.movementId)?.name ?? 'set')
  }

  function openPicker(value: string) {
    const key = value === 'add' ? 'add' : 'swap'
    navigate({ search: `?${key}=${value === 'add' ? '1' : encodeURIComponent(value)}` }, { state: { picker: true } })
  }

  function closePicker() {
    if ((location.state as { picker?: boolean } | null)?.picker) navigate(-1)
    else setParams({}, { replace: true })
  }

  function pick(ids: string[]) {
    const all = history ?? []
    if (picker === 'add') {
      edit((x) => addExercises(x, ids.map((id) => newExercise(id, trackingOf(id), all))))
    } else if (picker && ids[0]) {
      const id = ids[0]
      edit((x) => swapExercise(x, picker, newExercise(id, trackingOf(id), all)))
    }
    closePicker()
  }

  async function finish() {
    const result = await finishSession(s.id)
    await skipRest()
    navigate(`/train/sessions/${encodeURIComponent(s.id)}?done=1&train=${result}`, { replace: true })
  }

  async function discard() {
    await deleteSession(s.id)
    await skipRest()
    navigate('/train', { replace: true })
  }

  return (
    <div className="pb-36 md:pb-32">
      <BackLink />
      <PageHeader
        title={s.name}
        kicker="Session in progress"
        aside={
          <Button onClick={() => setConfirm(hasDoneSets(s) ? 'finish' : 'discard')} className="shrink-0">
            Finish
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-panel-edge bg-panel px-4 py-2">
        <div className="flex gap-6">
          <p>
            <span className="label block">Time</span>
            <span className="font-display text-2xl font-bold tabular-nums">{formatClock(now - s.startedAt)}</span>
          </p>
          <p>
            <span className="label block">Sets</span>
            <span className="font-display text-2xl font-bold tabular-nums">
              {done}/{total}
            </span>
          </p>
        </div>
        <UnitToggle compact />
      </div>

      {error && (
        <Panel title="Movements" className="mb-4">
          <p className="text-muted">Couldn’t load movement names. Logging still works.</p>
          <Button variant="secondary" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </Panel>
      )}

      <div className="space-y-3">
        {s.exercises.length === 0 && (
          <div className="border border-dashed border-line px-4 py-6 text-center text-muted">
            Empty session. Add the movements you’re doing.
          </div>
        )}
        {s.exercises.map((ex, i) => {
          const movement = byId.get(ex.movementId)
          const tracking = trackingOf(ex.movementId)
          const last = lastTimeSets(history, ex.movementId, s.id)
          const lastSession = sessionsWith(history, ex.movementId, s.id)[0]
          const lastEx = lastSession?.exercises.find((e) => e.movementId === ex.movementId)
          const hint = lastEx && movement ? progressionHint(lastEx, movement) : undefined
          return (
            <ExerciseCard
              key={ex.key}
              exercise={ex}
              movement={movement}
              tracking={tracking}
              units={units}
              label={labels[i]}
              lastTime={last.length ? formatSets(last, tracking, units) : undefined}
              hint={hint}
              edit={edit}
              onTick={(set, isDone) => tick(ex, i, set, isDone)}
              onSwap={() => openPicker(ex.key)}
              onRemove={() => (ex.sets.some((x) => x.done) ? setConfirm({ remove: ex }) : edit((x) => removeExercise(x, ex.key)))}
            />
          )
        })}
        <Button variant="secondary" className="w-full" onClick={() => openPicker('add')}>
          <PlusIcon size={20} />
          Add movement
        </Button>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button className="flex-1" onClick={() => setConfirm(hasDoneSets(s) ? 'finish' : 'discard')}>
            Finish session
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('discard')}>
            Discard
          </Button>
        </div>
      </div>

      <RestTimerBar />

      {picker && (
        <MovementPicker
          movements={movements}
          error={error}
          retry={retry}
          inWorkout={new Set(s.exercises.map((e) => e.movementId))}
          onAdd={pick}
          onClose={closePicker}
          title={picker === 'add' ? 'Add movements' : 'Swap movement'}
          single={picker !== 'add'}
        />
      )}

      {confirm === 'finish' && (
        <Dialog title="Finish session?" onClose={() => setConfirm(null)}>
          <p>
            {done} of {total} sets done.
            {done < total && ' Sets you didn’t tick are left out.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={finish}>Finish</Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep going
            </Button>
          </div>
        </Dialog>
      )}
      {confirm === 'discard' && (
        <Dialog title="Discard session?" onClose={() => setConfirm(null)}>
          <p>{hasDoneSets(s) ? 'Everything logged in this session is thrown away.' : 'Nothing is ticked yet, so there’s nothing to save.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={discard}>Discard</Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep going
            </Button>
          </div>
        </Dialog>
      )}
      {confirm && typeof confirm === 'object' && (
        <Dialog title="Remove movement?" onClose={() => setConfirm(null)}>
          <p>
            Remove <strong>{byId.get(confirm.remove.movementId)?.name ?? 'this movement'}</strong> and its ticked sets from this session?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                edit((x) => removeExercise(x, confirm.remove.key))
                setConfirm(null)
              }}
            >
              Remove
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </div>
        </Dialog>
      )}
      {startDialog}
    </div>
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
