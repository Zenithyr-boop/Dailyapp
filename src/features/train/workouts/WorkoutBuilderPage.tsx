import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { ChevronLeftIcon, CopyIcon, LinkIcon, PlusIcon, TrashIcon, UnlinkIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { StatBlock } from '../../../components/StatBlock'
import type { WorkoutItem, WorkoutTemplate } from '../../../lib/db'
import { canonical } from '../../../lib/sync/merge'
import { useMovements } from '../library/useMovements'
import { durationParts, estimateSeconds } from './duration'
import { inputClass } from './fields'
import { ItemCard } from './ItemCard'
import { MovementPicker } from './MovementPicker'
import { isStarterId } from './starters'
import { linkedToNext, linkWithNext, moveItem, removeItem, supersetLabels, unlinkFromNext } from './supersets'
import { newItem } from './targets'
import { useDragReorder } from './useDragReorder'
import {
  blankWorkout,
  deleteWorkout,
  duplicateWorkout,
  getWorkout,
  NAME_MAX,
  normalizeWorkout,
  NOTE_MAX,
  saveWorkout,
} from './workoutsRepo'

/** The parts of a workout the builder edits (compared to spot unsaved changes). */
const content = (w: WorkoutTemplate) => canonical({ name: w.name, note: w.note || undefined, items: w.items })

/**
 * Create or edit a workout template: name, note, movements with sets, target,
 * RPE, rest and note, supersets, reordering. Changes are kept in a draft until
 * Save; leaving with unsaved changes asks first.
 */
export function WorkoutBuilderPage() {
  const { id = '' } = useParams()
  const isNew = id === ''
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const formId = useId()

  const { movements, error, retry } = useMovements()
  const byId = useMemo(() => new Map(movements?.map((m) => [m.id, m])), [movements])

  const [draft, setDraft] = useState<WorkoutTemplate | null>(isNew ? blankWorkout() : null)
  const [baseline, setBaseline] = useState(() => (isNew ? content(blankWorkout()) : ''))
  const [missing, setMissing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  /** Set right before navigating away on purpose (after save or delete). */
  const leaving = useRef(false)

  useEffect(() => {
    if (isNew) return
    let active = true
    getWorkout(id).then((w) => {
      if (!active) return
      if (!w) setMissing(true)
      else {
        setDraft(w)
        setBaseline(content(w))
      }
    })
    return () => {
      active = false
    }
  }, [id, isNew])

  const dirty = !!draft && content(draft) !== baseline
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )

  // Closing the tab or reloading with unsaved changes: let the browser ask.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const items = useMemo(() => draft?.items ?? [], [draft])
  const setItems = (next: WorkoutItem[]) => {
    setSavedNote(false)
    setDraft((d) => d && { ...d, items: next })
  }
  const drag = useDragReorder(items.length, (from, to) => setItems(moveItem(items, from, to)))
  const labels = supersetLabels(items)
  const totalSets = items.reduce((n, item) => n + item.sets, 0)
  const duration = durationParts(estimateSeconds(items))
  const picking = params.get('add') === '1'

  function openPicker() {
    navigate({ search: '?add=1' }, { state: { picker: true }, preventScrollReset: true })
  }

  function closePicker() {
    if ((location.state as { picker?: boolean } | null)?.picker) navigate(-1)
    else setParams({}, { replace: true, preventScrollReset: true })
  }

  function addMovements(ids: string[]) {
    const added = ids.map((mid) => newItem(mid, byId.get(mid)?.tracking ?? 'weight_reps'))
    setItems([...items, ...added])
    closePicker()
  }

  /** Save the draft. A new workout then moves to its own URL, unless we're leaving anyway. */
  async function save(openSaved = true) {
    if (!draft) return
    const cleaned = { ...draft, ...normalizeWorkout(draft, (mid) => byId.get(mid)?.tracking) }
    const savedId = await saveWorkout(cleaned)
    const next = { ...cleaned, id: savedId }
    setDraft(next)
    setBaseline(content(next))
    setSavedNote(true)
    if (isNew && openSaved) {
      leaving.current = true
      navigate(`/train/workouts/${encodeURIComponent(savedId)}`, { replace: true })
    }
  }

  async function duplicate() {
    const copyId = await duplicateWorkout(id)
    if (copyId) navigate(`/train/workouts/${encodeURIComponent(copyId)}`)
  }

  async function remove() {
    await deleteWorkout(id)
    leaving.current = true
    navigate('/train', { replace: true })
  }

  const backLink = (
    <Link
      to="/train"
      className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
    >
      <ChevronLeftIcon size={18} />
      Train
    </Link>
  )

  if (missing) {
    return (
      <>
        {backLink}
        <PageHeader title="Workout not found" />
        <Panel title="Workout">
          <p className="text-muted">This workout was deleted, maybe on another device.</p>
        </Panel>
      </>
    )
  }

  if (!draft) {
    return (
      <>
        {backLink}
        <p className="text-muted" role="status">
          Loading workout…
        </p>
      </>
    )
  }

  const title = draft.name.trim() || (isNew ? 'New workout' : 'Untitled workout')

  return (
    <>
      {backLink}
      <PageHeader
        title={title}
        kicker={isNew ? 'New workout' : isStarterId(id) ? 'Starter template' : 'Workout'}
        aside={
          <Button onClick={() => save()} disabled={!dirty} className="shrink-0">
            Save
          </Button>
        }
      />
      <p className="sr-only" role="status">
        {savedNote ? 'Saved' : ''}
      </p>

      <div className="space-y-4">
        <Panel title="Summary">
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Est. time" value={duration.value} unit={duration.unit} />
            <StatBlock label="Movements" value={items.length} />
            <StatBlock label="Sets" value={totalSets} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {dirty ? 'Unsaved changes.' : savedNote ? 'Saved.' : 'Estimate counts work, rest and warm-up between movements.'}
          </p>
        </Panel>

        <Panel title="Details">
          <div className="space-y-3">
            <div>
              <label htmlFor={`${formId}-name`} className="label mb-1 block">
                Name
              </label>
              <input
                id={`${formId}-name`}
                value={draft.name}
                maxLength={NAME_MAX}
                onChange={(e) => {
                  setSavedNote(false)
                  setDraft({ ...draft, name: e.target.value })
                }}
                placeholder="e.g. Push day"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${formId}-note`} className="label mb-1 block">
                Note
              </label>
              <textarea
                id={`${formId}-note`}
                value={draft.note ?? ''}
                maxLength={NOTE_MAX}
                rows={2}
                onChange={(e) => {
                  setSavedNote(false)
                  setDraft({ ...draft, note: e.target.value || undefined })
                }}
                placeholder="Optional, e.g. Warm up with 5 min on the bike"
                className={`${inputClass} py-2.5`}
              />
            </div>
          </div>
        </Panel>

        <section aria-labelledby={`${formId}-movements`}>
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 id={`${formId}-movements`} className="label">
              Movements
            </h2>
            {items.length > 1 && <p className="text-xs text-muted">Drag the handle or use the arrows to reorder</p>}
          </div>
          {items.length === 0 ? (
            <div className="border border-dashed border-line px-4 py-6 text-center text-muted">
              No movements yet. Add some from the library.
            </div>
          ) : (
            <ol aria-label="Movements">
              {items.map((item, i) => {
                const linked = linkedToNext(items, i)
                const movement = byId.get(item.movementId)
                const name = movement?.name ?? 'movement'
                const nextName = byId.get(items[i + 1]?.movementId ?? '')?.name ?? 'next movement'
                return (
                  <li key={item.key} data-drag-item style={drag.itemStyle(i)}>
                    <ItemCard
                      item={item}
                      movement={movement}
                      index={i}
                      count={items.length}
                      supersetLabel={labels[i]}
                      linkedToNext={linked}
                      nextLabel={labels[i + 1]}
                      dragging={drag.dragging === i}
                      handleProps={drag.handleProps(i)}
                      onChange={(next) => setItems(items.map((x, k) => (k === i ? next : x)))}
                      onMove={(to) => setItems(moveItem(items, i, to))}
                      onRemove={() => setItems(removeItem(items, i))}
                    />
                    {i < items.length - 1 && (
                        <div className={`flex items-center gap-2 ${linked ? 'border-l-2 border-accent ml-[21px] pl-3' : 'pl-1'}`}>
                          <button
                            type="button"
                            onClick={() => setItems(linked ? unlinkFromNext(items, i) : linkWithNext(items, i))}
                            aria-label={linked ? `Split superset between ${name} and ${nextName}` : `Superset ${name} with ${nextName}`}
                            className={`inline-flex min-h-touch items-center gap-2 px-2 font-display text-sm font-semibold uppercase tracking-wider ${
                              linked ? 'text-accent hover:text-text' : 'text-faint hover:text-accent'
                            }`}
                          >
                            {linked ? <UnlinkIcon size={18} /> : <LinkIcon size={18} />}
                            {linked ? `Superset · split` : 'Superset with next'}
                          </button>
                        </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          <Button variant="secondary" className="mt-3 w-full" onClick={openPicker}>
            <PlusIcon size={20} />
            Add movements
          </Button>
        </section>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => save()} disabled={!dirty} className="flex-1">
            Save workout
          </Button>
          {!isNew && (
            <>
              <Button variant="secondary" onClick={duplicate} disabled={dirty} title={dirty ? 'Save first' : undefined}>
                <CopyIcon size={18} />
                Duplicate
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={18} />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {picking && (
        <MovementPicker
          movements={movements}
          error={error}
          retry={retry}
          inWorkout={new Set(items.map((x) => x.movementId))}
          onAdd={addMovements}
          onClose={closePicker}
        />
      )}

      {confirmDelete && (
        <Dialog title="Delete workout?" onClose={() => setConfirmDelete(false)}>
          <p>
            Delete <strong>{title}</strong>? It’s removed on all your devices.
            {isStarterId(id) && ' You can bring starter templates back from the Train tab.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={remove}>Delete</Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        </Dialog>
      )}

      {blocker.state === 'blocked' && (
        <Dialog title="Discard changes?" onClose={() => blocker.reset()}>
          <p>You have unsaved changes to {title}.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await save(false)
                blocker.proceed()
              }}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => blocker.proceed()}>
              Discard
            </Button>
            <Button variant="secondary" onClick={() => blocker.reset()}>
              Keep editing
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
