/**
 * Inputs shared by onboarding (one per screen) and Me → Goals (all together).
 * Values are always stored metric (kg, cm); these show them in the user's units.
 */
import { useId, useState, type ReactNode } from 'react'
import { StatBlock } from '../../../components/StatBlock'
import { cmToFtIn, ftInToCm, kgToLb, toKg, type HeightUnits, type UnitSystem } from '../../../lib/units'
import { inputClass, NumberField } from '../../train/workouts/fields'
import { MAX_AGE, MIN_AGE, type GoalKind } from './coachTargets'
import type { ChoiceOption } from './options'
import { formatRate, isFastestRate, maxLossKgPerWeek, nearestRateOption, rateOptions, type TargetResult } from './targets'

/** Radio group drawn as square tiles. The legend names the group (and can be the screen's question). */
export function ChoiceGroup<T extends string>({
  legend,
  legendClassName = 'label',
  options,
  value,
  onChange,
  columns = 1,
}: {
  legend: ReactNode
  legendClassName?: string
  options: readonly ChoiceOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  columns?: 1 | 2 | 3
}) {
  const name = useId()
  // Three across only from tablet width up; on phones they stack (descriptions need the room).
  const grid = columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1'
  const centered = columns === 3 ? 'sm:items-center sm:text-center' : columns === 2 ? 'items-center text-center' : ''
  return (
    <fieldset>
      <legend className={legendClassName}>{legend}</legend>
      <div className={`mt-2 grid gap-1 ${grid}`}>
        {options.map((o) => {
          const selected = value === o.value
          return (
            <label
              key={o.value}
              className={`flex min-h-touch cursor-pointer flex-col justify-center border px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                centered
              } ${selected ? 'border-accent bg-accent text-on-accent' : 'border-line text-text hover:border-accent'}`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span className="font-display text-lg font-bold uppercase tracking-wider">{o.label}</span>
              {o.description && (
                <span className={`text-sm ${selected ? 'text-on-accent' : 'text-muted'}`}>{o.description}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Labelled text field wrapper. */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label block">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function NameInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      id={id}
      value={value}
      maxLength={40}
      autoComplete="nickname"
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your name"
      className={inputClass}
    />
  )
}

export function BirthYearInput({ id, value, onChange }: { id: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  const year = new Date().getFullYear()
  return (
    <NumberField id={id} value={value} onChange={onChange} min={year - MAX_AGE} max={year - MIN_AGE} optional placeholder={String(year - 30)} />
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Weight in kg or lb; reports kg. */
export function WeightInput({
  id,
  kg,
  units,
  onChange,
}: {
  id: string
  kg: number | undefined
  units: UnitSystem
  onChange: (kg: number | undefined) => void
}) {
  const metric = units === 'metric'
  const shown = kg === undefined ? undefined : round1(metric ? kg : kgToLb(kg))
  return (
    <div className="flex items-center gap-2">
      <NumberField
        key={units}
        id={id}
        value={shown}
        onChange={(v) => onChange(v === undefined ? undefined : toKg(v, units))}
        min={metric ? 30 : 66}
        max={metric ? 300 : 660}
        precision={1}
        optional
        placeholder={metric ? '75' : '165'}
        className="max-w-40"
      />
      <span className="label">{metric ? 'kg' : 'lb'}</span>
    </div>
  )
}

/** Height in cm, or feet + inches; reports cm. */
export function HeightInput({
  id,
  cm,
  units,
  onChange,
}: {
  id: string
  cm: number | undefined
  units: HeightUnits
  onChange: (cm: number | undefined) => void
}) {
  if (units === 'cm') {
    return (
      <div className="flex items-center gap-2">
        <NumberField
          id={id}
          value={cm === undefined ? undefined : Math.round(cm)}
          onChange={onChange}
          min={120}
          max={230}
          optional
          placeholder="175"
          className="max-w-40"
        />
        <span className="label">cm</span>
      </div>
    )
  }
  return <FeetInches id={id} cm={cm} onChange={onChange} />
}

function FeetInches({ id, cm, onChange }: { id: string; cm: number | undefined; onChange: (cm: number | undefined) => void }) {
  const [parts, setParts] = useState<{ ft?: number; inches?: number }>(() => (cm === undefined ? {} : cmToFtIn(cm)))
  function update(next: { ft?: number; inches?: number }) {
    setParts(next)
    onChange(next.ft === undefined ? undefined : ftInToCm(next.ft, next.inches ?? 0))
  }
  return (
    <div className="flex items-center gap-2">
      <NumberField
        id={id}
        aria-label="Feet"
        value={parts.ft}
        onChange={(ft) => update({ ...parts, ft })}
        min={3}
        max={8}
        optional
        placeholder="5"
        className="max-w-20"
      />
      <span className="label">ft</span>
      <NumberField
        aria-label="Inches"
        value={parts.inches}
        onChange={(inches) => update({ ...parts, inches })}
        min={0}
        max={11}
        optional
        placeholder="9"
        className="max-w-20"
      />
      <span className="label">in</span>
    </div>
  )
}

/** Weekly rate options for a lose / gain goal, in the user's unit. */
export function RateChoice({
  goal,
  units,
  weightKg,
  rateKg,
  onChange,
  legend,
  legendClassName,
}: {
  goal: 'lose' | 'gain'
  units: UnitSystem
  weightKg?: number
  rateKg: number
  onChange: (kg: number) => void
  legend: ReactNode
  legendClassName?: string
}) {
  const options = rateOptions(goal, units)
  const selected = nearestRateOption(goal, units, rateKg)
  const maxLoss = goal === 'lose' && weightKg ? maxLossKgPerWeek(weightKg) : undefined
  return (
    <div className="space-y-3">
      <ChoiceGroup
        legend={legend}
        legendClassName={legendClassName}
        options={options.map((o, i) => ({
          value: String(o.shown),
          label: `${o.shown} ${o.unit} / week`,
          description:
            maxLoss !== undefined && o.kg > maxLoss + 1e-9
              ? `Capped at ${formatRate(maxLoss, units)} for you (1% of body weight)`
              : i === 0
                ? 'Slow and easy to keep up'
                : i === options.length - 1
                  ? 'Fastest'
                  : undefined,
        }))}
        value={String(selected.shown)}
        onChange={(v) => onChange(options.find((o) => String(o.shown) === v)!.kg)}
      />
      {isFastestRate(goal, units, rateKg) && <Note>{goal === 'lose' ? AGGRESSIVE_LOSS_NOTE : AGGRESSIVE_GAIN_NOTE}</Note>}
    </div>
  )
}

const AGGRESSIVE_LOSS_NOTE =
  'This is the fastest option. It works best in short stretches: if your energy, sleep or training start to slip, ease back to a slower rate. Slower loss keeps more muscle.'
const AGGRESSIVE_GAIN_NOTE =
  'This is the fastest option. Expect more of the gain to be fat; a slower rate keeps it leaner.'

/** A calm, flat note with an accent edge. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="border-l-2 border-accent bg-bg px-3 py-2 text-sm text-muted">{children}</p>
}

/** Calories + macros as big numbers, with what they're based on and any safety notes. */
export function TargetsSummary({ result, goal, units }: { result: TargetResult; goal: GoalKind; units: UnitSystem }) {
  const fmt = new Intl.NumberFormat()
  const expected = result.expectedKgPerWeek
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="Calories" value={fmt.format(result.kcal)} unit="kcal" />
        <StatBlock label="Protein" value={result.proteinG} unit="g" />
        <StatBlock label="Carbs" value={result.carbsG} unit="g" />
        <StatBlock label="Fat" value={result.fatG} unit="g" />
      </div>
      <p className="text-sm text-muted">
        Maintenance is about {fmt.format(result.maintenance)} kcal a day.
        {goal !== 'maintain' && !result.floored && Math.abs(expected) > 0.001 && (
          <> At these numbers you’d {expected < 0 ? 'lose' : 'gain'} about {formatRate(Math.abs(expected), units, { approx: true })} a week.</>
        )}
      </p>
      {result.capped && (
        <Note>
          Weight loss is capped at {formatRate(result.rateKgPerWeek, units)} a week for you, 1% of your body weight. Losing
          faster tends to cost muscle and is hard to keep up.
        </Note>
      )}
      {result.floored && (
        <Note>
          We never set calories below {fmt.format(result.floor)} kcal a day.
          {goal === 'lose' && expected < 0 && (
            <> At this number you’d lose about {formatRate(Math.abs(expected), units, { approx: true })} a week, a little slower than you picked.</>
          )}
        </Note>
      )}
    </div>
  )
}
