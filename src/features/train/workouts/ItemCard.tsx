import { useId, type CSSProperties, type HTMLAttributes } from 'react'
import { ArrowDownIcon, ArrowUpIcon, GripIcon, TrashIcon } from '../../../components/icons'
import { label } from '../library/catalog'
import { TRACKING_LABELS, type Movement } from '../library/types'
import type { WorkoutItem } from '../../../lib/db'
import { IconButton, inputClass, NumberField, Stepper } from './fields'
import { formatSeconds, kindFromItem, LIMITS, RPE_VALUES, targetKind } from './targets'

interface ItemCardProps {
  item: WorkoutItem
  movement: Movement | undefined
  index: number
  count: number
  /** "A1", "A2"… inside a superset. */
  supersetLabel?: string
  /** Leads straight into the next movement of its superset (no rest of its own). */
  linkedToNext: boolean
  /** Label of the next movement in the superset, e.g. "A2". */
  nextLabel?: string
  dragging: boolean
  handleProps: HTMLAttributes<HTMLButtonElement> & { style: CSSProperties }
  onChange: (item: WorkoutItem) => void
  onMove: (to: number) => void
  onRemove: () => void
}

/** One movement in the builder: sets, target, RPE, rest and note. */
export function ItemCard({
  item,
  movement,
  index,
  count,
  supersetLabel,
  linkedToNext,
  nextLabel,
  dragging,
  handleProps,
  onChange,
  onMove,
  onRemove,
}: ItemCardProps) {
  const id = useId()
  const name = movement?.name ?? 'Unknown movement'
  const kind = movement ? targetKind(movement.tracking) : kindFromItem(item)
  const set = (patch: Partial<WorkoutItem>) => onChange({ ...item, ...patch })
  const details = movement
    ? [movement.primaryMuscles.map(label).join(', '), TRACKING_LABELS[movement.tracking]].filter(Boolean).join(' · ')
    : 'Removed from your movements'

  return (
    <article
      aria-label={supersetLabel ? `${supersetLabel} ${name}` : name}
      className={`border bg-panel ${dragging ? 'border-accent' : supersetLabel ? 'border-panel-edge border-l-accent border-l-2' : 'border-panel-edge'}`}
    >
      <header className="flex items-start gap-1 border-b border-line-soft pr-1">
        <button
          type="button"
          aria-label={`Reorder ${name}: drag, or press the arrow keys`}
          className="grid size-touch shrink-0 select-none place-items-center text-faint hover:text-accent"
          {...handleProps}
        >
          <GripIcon size={20} />
        </button>
        <div className="min-w-0 flex-1 py-2.5">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg leading-tight">
            {supersetLabel && <span className="font-display text-accent">{supersetLabel}</span>}
            <span className="normal-case tracking-normal font-body text-base font-semibold">{name}</span>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">{details}</p>
        </div>
        <IconButton label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ArrowUpIcon size={18} />
        </IconButton>
        <IconButton label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          <ArrowDownIcon size={18} />
        </IconButton>
        <IconButton label={`Remove ${name}`} onClick={onRemove}>
          <TrashIcon size={18} />
        </IconButton>
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3 sm:grid-cols-4">
        <div>
          <span className="label mb-1 block">
            Sets
          </span>
          <Stepper
            label={`Sets for ${name}`}
            value={item.sets}
            min={LIMITS.sets.min}
            max={LIMITS.sets.max}
            onChange={(sets) => set({ sets })}
          />
        </div>

        {kind === 'reps' ? (
          <fieldset>
            <legend className="label mb-1">Reps</legend>
            <div className="flex items-center gap-1">
              <NumberField
                aria-label={`Minimum reps for ${name}`}
                value={item.repsMin}
                min={LIMITS.reps.min}
                max={LIMITS.reps.max}
                onChange={(n) => set({ repsMin: n, repsMax: Math.max(n ?? 1, item.repsMax ?? 1) })}
              />
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <NumberField
                aria-label={`Maximum reps for ${name}`}
                value={item.repsMax}
                min={LIMITS.reps.min}
                max={LIMITS.reps.max}
                onChange={(n) => set({ repsMax: n })}
              />
            </div>
          </fieldset>
        ) : kind === 'time' ? (
          <div>
            <label htmlFor={`${id}-sec`} className="label mb-1 block">
              Seconds
            </label>
            <NumberField
              id={`${id}-sec`}
              value={item.seconds}
              min={LIMITS.seconds.min}
              max={LIMITS.seconds.max}
              onChange={(n) => set({ seconds: n })}
            />
          </div>
        ) : (
          <fieldset>
            <legend className="label mb-1">Minutes · metres</legend>
            <div className="flex items-center gap-1">
              <NumberField
                aria-label={`Minutes for ${name}`}
                value={item.seconds === undefined ? undefined : Math.round(item.seconds / 60)}
                min={1}
                max={60}
                onChange={(n) => set({ seconds: n === undefined ? undefined : n * 60 })}
              />
              <NumberField
                aria-label={`Metres for ${name} (optional)`}
                value={item.meters}
                min={LIMITS.meters.min}
                max={LIMITS.meters.max}
                optional
                onChange={(n) => set({ meters: n || undefined })}
              />
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor={`${id}-rpe`} className="label mb-1 block">
            RPE
          </label>
          <select
            id={`${id}-rpe`}
            value={item.rpe ?? ''}
            onChange={(e) => set({ rpe: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputClass} font-display text-lg font-semibold`}
          >
            <option value="">—</option>
            {RPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {v % 1 ? v.toFixed(1) : v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label mb-1 block">Rest</span>
          {linkedToNext ? (
            <p className="flex min-h-touch items-center border border-dashed border-line px-3 text-sm text-muted">
              None · straight to {nextLabel}
            </p>
          ) : (
            <Stepper
              label={`Rest for ${name}`}
              value={item.restSec}
              display={formatSeconds(item.restSec)}
              min={LIMITS.rest.min}
              max={LIMITS.rest.max}
              step={LIMITS.rest.step}
              onChange={(restSec) => set({ restSec })}
            />
          )}
        </div>

        <div className="col-span-2 sm:col-span-4">
          <label htmlFor={`${id}-note`} className="label mb-1 block">
            Note
          </label>
          <input
            id={`${id}-note`}
            value={item.note ?? ''}
            maxLength={LIMITS.note}
            onChange={(e) => set({ note: e.target.value || undefined })}
            placeholder="e.g. Pause at the bottom"
            className={inputClass}
          />
        </div>
      </div>
    </article>
  )
}
