import type { LoggedSet, Session, SessionExercise } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import { CheckIcon, MinusIcon, PlusIcon, SwapIcon, TrashIcon } from '../../../components/icons'
import type { Movement, TrackingType } from '../library/types'
import { IconButton, inputClass, NumberField } from '../workouts/fields'
import { formatRpe, formatSeconds, formatTarget, LIMITS, RPE_VALUES } from '../workouts/targets'
import type { ProgressionHint } from './progression'
import { addSet, applyWeight, patchSet, removeSet } from './sessionsRepo'
import { displayWeight, formatNumber, plateRoundKg, unitLabel, weightToKg } from './weights'

interface ExerciseCardProps {
  exercise: SessionExercise
  movement: Movement | undefined
  tracking: TrackingType
  units: UnitSystem
  /** "A1", "A2"… inside a superset. */
  label?: string
  /** "80×8 · 80×7 · 80×6" */
  lastTime?: string
  /** From the last session with this movement. */
  hint?: ProgressionHint
  edit: (change: (s: Session) => Session) => void
  onTick: (set: LoggedSet, done: boolean) => void
  onSwap: () => void
  onRemove: () => void
}

type Column = 'kg' | 'assist' | 'reps' | 'rpe' | 'seconds' | 'minutes' | 'meters'

const COLUMNS: Record<TrackingType, Column[]> = {
  weight_reps: ['kg', 'reps', 'rpe'],
  assisted: ['assist', 'reps', 'rpe'],
  bodyweight_reps: ['reps', 'rpe'],
  time: ['seconds', 'rpe'],
  distance_time: ['minutes', 'meters'],
}

/** One movement in the logger: targets, last time, the next-step hint and its set rows. */
export function ExerciseCard({
  exercise: ex,
  movement,
  tracking,
  units,
  label,
  lastTime,
  hint,
  edit,
  onTick,
  onSwap,
  onRemove,
}: ExerciseCardProps) {
  const name = movement?.name ?? 'Unknown movement'
  const unit = unitLabel(units)
  const columns = COLUMNS[tracking]
  const t = ex.target
  const targetText = t
    ? [formatTarget({ key: '', movementId: '', ...t }), t.rpe !== undefined && formatRpe(t.rpe), `rest ${formatSeconds(t.restSec)}`]
        .filter(Boolean)
        .join(' · ')
    : undefined
  const open = ex.sets.filter((s) => !s.done)
  const suggestedKg = hint?.action === 'increase' ? plateRoundKg(hint.toKg, units) : undefined
  const showSuggestion = suggestedKg !== undefined && open.some((s) => Math.abs((s.kg ?? 0) - suggestedKg) > 1e-6)
  const repsHint = t?.repsMax !== undefined ? String(t.repsMax) : undefined
  const grid = { gridTemplateColumns: `2rem repeat(${columns.length}, minmax(0, 1fr)) 2.75rem` }

  const head: Record<Column, string> = {
    kg: unit,
    assist: `Assist ${unit}`,
    reps: 'Reps',
    rpe: 'RPE',
    seconds: 'Sec',
    minutes: 'Min',
    meters: 'Metres',
  }

  function field(set: LoggedSet, n: number, col: Column) {
    const patch = (p: Partial<LoggedSet>) => edit((s) => patchSet(s, ex.key, set.key, p))
    const aria = `${head[col]}, set ${n}, ${name}`
    switch (col) {
      case 'kg':
      case 'assist':
        return (
          <NumberField
            aria-label={aria}
            live={false}
            optional
            precision={2}
            value={set.kg === undefined ? undefined : displayWeight(set.kg, units)}
            min={0}
            max={units === 'metric' ? 1000 : 2200}
            onChange={(v) => patch({ kg: v === undefined ? undefined : weightToKg(v, units) })}
            className="px-1"
          />
        )
      case 'reps':
        return (
          <NumberField
            aria-label={aria}
            live={false}
            optional
            value={set.reps}
            min={0}
            max={LIMITS.reps.max}
            placeholder={repsHint}
            onChange={(v) => patch({ reps: v })}
            className="px-1"
          />
        )
      case 'seconds':
        return (
          <NumberField
            aria-label={aria}
            live={false}
            optional
            value={set.seconds}
            min={0}
            max={LIMITS.seconds.max}
            onChange={(v) => patch({ seconds: v })}
            className="px-1"
          />
        )
      case 'minutes':
        return (
          <NumberField
            aria-label={aria}
            live={false}
            optional
            precision={1}
            value={set.seconds === undefined ? undefined : +(set.seconds / 60).toFixed(1)}
            min={0}
            max={600}
            onChange={(v) => patch({ seconds: v === undefined ? undefined : Math.round(v * 60) })}
            className="px-1"
          />
        )
      case 'meters':
        return (
          <NumberField
            aria-label={aria}
            live={false}
            optional
            value={set.meters}
            min={0}
            max={LIMITS.meters.max}
            onChange={(v) => patch({ meters: v || undefined })}
            className="px-1"
          />
        )
      case 'rpe':
        return (
          <select
            aria-label={aria}
            value={set.rpe ?? ''}
            onChange={(e) => patch({ rpe: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputClass} appearance-none px-1 text-center font-display text-lg font-semibold`}
          >
            <option value="">–</option>
            {RPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {v % 1 ? v.toFixed(1) : v}
              </option>
            ))}
          </select>
        )
    }
  }

  return (
    <article
      aria-label={label ? `${label} ${name}` : name}
      className={`border bg-panel ${label ? 'border-panel-edge border-l-2 border-l-accent' : 'border-panel-edge'}`}
    >
      <header className="flex items-start gap-1 border-b border-line-soft pl-3 pr-1">
        <div className="min-w-0 flex-1 py-2.5">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg leading-tight">
            {label && <span className="font-display text-accent">{label}</span>}
            <span className="font-body text-base font-semibold normal-case tracking-normal">{name}</span>
          </h2>
          {targetText && <p className="mt-0.5 text-sm text-muted">Target {targetText}</p>}
          {t?.note && <p className="mt-0.5 text-sm text-muted">{t.note}</p>}
        </div>
        <IconButton label={`Swap ${name}`} onClick={onSwap}>
          <SwapIcon size={18} />
        </IconButton>
        <IconButton label={`Remove ${name}`} onClick={onRemove}>
          <TrashIcon size={18} />
        </IconButton>
      </header>

      <div className="space-y-1 px-3 pt-2 text-sm">
        <p className="text-muted">{lastTime ? `Last time: ${lastTime}` : 'First time logging this movement.'}</p>
        {hint?.action === 'keep' && (
          <p className="text-muted">
            Next step: stay at {formatNumber(displayWeight(hint.kg, units))} {unit} ({hint.reason} last time).
          </p>
        )}
        {showSuggestion && hint?.action === 'increase' && (
          <button
            type="button"
            onClick={() => edit((s) => applyWeight(s, ex.key, suggestedKg))}
            className="inline-flex min-h-touch items-center gap-2 border border-accent px-3 font-display text-sm font-bold uppercase tracking-wider text-accent hover:bg-accent hover:text-on-accent"
          >
            Try {formatNumber(displayWeight(suggestedKg, units))} {unit} (+{formatNumber(displayWeight(hint.byKg, units))})
          </button>
        )}
      </div>

      <div className="px-3 pt-2 pb-3">
        <div className="grid items-end gap-1.5 pb-1" style={grid} aria-hidden="true">
          <span className="label">Set</span>
          {columns.map((c) => (
            <span key={c} className="label text-center">
              {head[c]}
            </span>
          ))}
          <span className="label text-center">Done</span>
        </div>
        <ol className="space-y-1.5">
          {ex.sets.map((set, i) => (
            <li
              key={set.key}
              className={`grid items-center gap-1.5 ${set.done ? '[&_input]:border-accent/40 [&_select]:border-accent/40' : ''}`}
              style={grid}
            >
              <span className={`font-display text-lg font-bold tabular-nums ${set.done ? 'text-accent' : 'text-muted'}`}>{i + 1}</span>
              {columns.map((c) => (
                <div key={c}>{field(set, i + 1, c)}</div>
              ))}
              <button
                type="button"
                aria-pressed={set.done}
                aria-label={`Set ${i + 1} done, ${name}`}
                onClick={() => onTick(set, !set.done)}
                className={`grid size-touch place-items-center border ${
                  set.done ? 'border-accent bg-accent text-on-accent' : 'border-faint text-transparent hover:border-accent hover:text-faint'
                }`}
              >
                <CheckIcon size={22} />
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => edit((s) => addSet(s, ex.key))}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-1.5 border border-line font-display text-sm font-bold uppercase tracking-wider text-muted hover:border-accent hover:text-accent"
          >
            <PlusIcon size={16} />
            Add set
          </button>
          <button
            type="button"
            disabled={ex.sets.length <= 1}
            onClick={() => edit((s) => removeSet(s, ex.key, ex.sets.at(-1)!.key))}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-1.5 border border-line font-display text-sm font-bold uppercase tracking-wider text-muted hover:border-accent hover:text-accent disabled:opacity-30"
          >
            <MinusIcon size={16} />
            Remove set
          </button>
        </div>
      </div>
    </article>
  )
}
