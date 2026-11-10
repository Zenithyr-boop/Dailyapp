import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { ChevronRightIcon, CopyIcon, PlayIcon, PlusIcon, TrashIcon } from '../../../components/icons'
import { Panel } from '../../../components/Panel'
import type { WorkoutTemplate } from '../../../lib/db'
import { Tag } from '../library/Chip'
import { useStartSession } from '../sessions/useStartSession'
import { estimateSeconds, formatDuration } from './duration'
import { IconButton } from './fields'
import { deleteWorkout, duplicateWorkout, listStoredWorkouts, restoreStarters, workoutLists } from './workoutsRepo'

/** The Train tab's workouts: the user's own, then the starter templates by program. */
export function WorkoutsSection() {
  const stored = useLiveQuery(listStoredWorkouts, [])
  const lists = useMemo(() => stored && workoutLists(stored), [stored])
  const [confirm, setConfirm] = useState<string | null>(null)
  const { start, dialog } = useStartSession()

  if (!lists) {
    return (
      <Panel title="Your workouts">
        <p className="text-muted" role="status">
          Loading workouts…
        </p>
      </Panel>
    )
  }

  const row = (w: WorkoutTemplate, edited?: boolean) => (
    <WorkoutRow
      key={w.id}
      workout={w}
      edited={edited}
      confirming={confirm === w.id}
      onStart={() => start(w)}
      onAskDelete={() => setConfirm(w.id)}
      onCancelDelete={() => setConfirm(null)}
      onDelete={async () => {
        await deleteWorkout(w.id)
        setConfirm(null)
      }}
    />
  )

  return (
    <>
      <Panel
        title="Your workouts"
        aside={
          <Link
            to="/train/workouts/new"
            className="-mr-2 inline-flex min-h-touch items-center gap-1.5 px-2 font-display text-sm font-bold uppercase tracking-wider text-accent hover:text-text"
          >
            <PlusIcon size={16} />
            New
          </Link>
        }
      >
        <Button variant="secondary" className="mb-4 w-full" onClick={() => start()}>
          <PlayIcon size={18} />
          Start empty session
        </Button>
        {lists.yours.length === 0 ? (
          <p className="text-muted">None yet. Make a new one, or duplicate a starter template below and make it yours.</p>
        ) : (
          <ul className="-mx-4 -mb-4 border-t border-line-soft">{lists.yours.map((w) => row(w))}</ul>
        )}
      </Panel>

      <Panel title="Starter templates" aside="Edit freely">
        <div className="-mx-4 -my-4">
          {lists.programs.map(({ program, rows }) => (
            <section key={program.id} aria-label={program.name} className="border-b border-line-soft last:border-b-0">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-lg leading-tight">{program.name}</h3>
                <p className="text-sm text-muted">{program.description}</p>
              </div>
              <ul>{rows.map((r) => row(r.workout, r.edited))}</ul>
            </section>
          ))}
          {lists.programs.length === 0 && <p className="px-4 py-4 text-muted">All starter templates deleted.</p>}
          {lists.deletedStarters > 0 && (
            <div className="border-t border-line-soft px-4 py-3">
              <Button variant="secondary" className="w-full" onClick={() => restoreStarters()}>
                Restore {lists.deletedStarters} deleted template{lists.deletedStarters === 1 ? '' : 's'}
              </Button>
            </div>
          )}
        </div>
      </Panel>
      {dialog}
    </>
  )
}

function WorkoutRow({
  workout: w,
  edited,
  confirming,
  onStart,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  workout: WorkoutTemplate
  edited?: boolean
  confirming: boolean
  onStart: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const name = w.name || 'Untitled workout'
  const count = w.items.length
  const summary = `${count} movement${count === 1 ? '' : 's'} · ≈ ${formatDuration(estimateSeconds(w.items))}`

  if (confirming) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-3 first:border-t-0">
        <p>
          Delete <strong>{name}</strong>? It’s removed on all your devices.
        </p>
        <div className="flex gap-2">
          <Button onClick={onDelete}>Delete</Button>
          <Button variant="secondary" onClick={onCancelDelete}>
            Keep
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center border-t border-line-soft pr-2 first:border-t-0">
      <Link to={`/train/workouts/${encodeURIComponent(w.id)}`} className="group flex min-h-touch min-w-0 flex-1 items-center gap-3 py-2.5 pl-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold leading-snug group-hover:text-accent">{name}</span>
            {edited && <Tag>Edited</Tag>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">{summary}</span>
        </span>
        <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
      </Link>
      <IconButton label={`Start ${name}`} onClick={onStart}>
        <PlayIcon size={18} />
      </IconButton>
      <IconButton label={`Duplicate ${name}`} onClick={() => duplicateWorkout(w.id)}>
        <CopyIcon size={18} />
      </IconButton>
      <IconButton label={`Delete ${name}`} onClick={onAskDelete}>
        <TrashIcon size={18} />
      </IconButton>
    </li>
  )
}
