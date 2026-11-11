import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import type { DayStat } from '../../lib/db'
import { dayLabel } from '../../lib/day'
import type { UnitSystem } from '../../lib/units'
import { submitOnEnter } from '../body/forms'
import { formatWater, ML_PER_OZ } from '../quests/links'
import { NumberField } from '../train/workouts/fields'
import { addWater, saveStats, type StatKind } from './statsRepo'

const TITLES: Record<StatKind, string> = { steps: 'Steps', sleep: 'Sleep', water: 'Water' }

/**
 * Quick entry for a day's steps, sleep or water (`?stat=` in the URL, so Back
 * closes it). Typed by hand on the website; the Android app will fill the same
 * values from Health Connect.
 */
export function StatDialog({
  stat,
  date,
  today,
  values,
  units,
  onClose,
}: {
  stat: StatKind
  date: string
  today: string
  values: { steps?: number; sleepMinutes?: number; waterMl?: number }
  units: UnitSystem
  onClose: () => void
}) {
  const title = `${TITLES[stat]} · ${dayLabel(date, today)}`
  return (
    <Dialog title={title} onClose={onClose}>
      {stat === 'steps' && <StepsForm date={date} steps={values.steps} onDone={onClose} />}
      {stat === 'sleep' && <SleepForm date={date} minutes={values.sleepMinutes} onDone={onClose} />}
      {stat === 'water' && <WaterForm date={date} ml={values.waterMl} units={units} onDone={onClose} />}
      <p className="text-xs text-muted">The Android app will read this from Health Connect. On the website, type it in.</p>
    </Dialog>
  )
}

function Actions({ canSave, hasValue, onClear, onCancel }: { canSave: boolean; hasValue: boolean; onClear: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={!canSave}>
          Save
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {hasValue && (
        <Button variant="secondary" className="w-full" onClick={onClear}>
          Clear
        </Button>
      )}
    </>
  )
}

async function save(date: string, field: DayStat, value: number | undefined, onDone: () => void) {
  await saveStats(date, { [field]: value })
  onDone()
}

function StepsForm({ date, steps, onDone }: { date: string; steps?: number; onDone: () => void }) {
  const id = useId()
  const [value, setValue] = useState(steps)
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (value !== undefined) void save(date, 'steps', value, onDone)
      }}
      onKeyDown={submitOnEnter}
      className="space-y-4"
    >
      <div>
        <label htmlFor={id} className="label block">
          Steps
        </label>
        <div className="mt-1 flex items-center gap-2">
          <NumberField id={id} value={value} onChange={setValue} min={0} max={200_000} optional placeholder="8000" className="max-w-44 text-2xl" />
          <span className="label">steps</span>
        </div>
      </div>
      <Actions canSave={value !== undefined} hasValue={steps !== undefined} onClear={() => void save(date, 'steps', undefined, onDone)} onCancel={onDone} />
    </form>
  )
}

function SleepForm({ date, minutes, onDone }: { date: string; minutes?: number; onDone: () => void }) {
  const id = useId()
  const [h, setH] = useState(minutes === undefined ? undefined : Math.floor(minutes / 60))
  const [m, setM] = useState(minutes === undefined ? undefined : minutes % 60)
  const total = h === undefined && m === undefined ? undefined : (h ?? 0) * 60 + (m ?? 0)
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (total !== undefined) void save(date, 'sleepMinutes', total, onDone)
      }}
      onKeyDown={submitOnEnter}
      className="space-y-4"
    >
      <fieldset>
        <legend className="label">Last night’s sleep</legend>
        <div className="mt-1 flex items-center gap-2">
          <NumberField id={`${id}-h`} aria-label="Hours" value={h} onChange={setH} min={0} max={24} optional placeholder="7" className="max-w-20 text-2xl" />
          <span className="label">h</span>
          <NumberField aria-label="Minutes" value={m} onChange={setM} min={0} max={59} optional placeholder="30" className="max-w-20 text-2xl" />
          <span className="label">min</span>
        </div>
      </fieldset>
      <Actions
        canSave={total !== undefined}
        hasValue={minutes !== undefined}
        onClear={() => void save(date, 'sleepMinutes', undefined, onDone)}
        onCancel={onDone}
      />
    </form>
  )
}

function WaterForm({ date, ml, units, onDone }: { date: string; ml?: number; units: UnitSystem; onDone: () => void }) {
  const id = useId()
  const metric = units === 'metric'
  const shown = ml === undefined ? undefined : metric ? +(ml / 1000).toFixed(2) : Math.round(ml / ML_PER_OZ)
  const [value, setValue] = useState(shown)
  const steps = metric ? [250, 500] : [Math.round(8 * ML_PER_OZ), Math.round(16 * ML_PER_OZ)]
  const stepLabel = (s: number) => (metric ? `+${s} ml` : `+${Math.round(s / ML_PER_OZ)} oz`)

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (value !== undefined) void save(date, 'waterMl', metric ? value * 1000 : value * ML_PER_OZ, onDone)
      }}
      onKeyDown={submitOnEnter}
      className="space-y-4"
    >
      <p className="font-display text-3xl font-bold tabular-nums">{formatWater(ml ?? 0, units)}</p>
      <div className="grid grid-cols-2 gap-2">
        {steps.map((s) => (
          <Button
            key={s}
            onClick={() => {
              void addWater(date, s)
              setValue(undefined)
            }}
          >
            {stepLabel(s)}
          </Button>
        ))}
      </div>
      <div>
        <label htmlFor={id} className="label block">
          Or set the total
        </label>
        <div className="mt-1 flex items-center gap-2">
          <NumberField
            id={id}
            value={value}
            onChange={setValue}
            min={0}
            max={metric ? 20 : 676}
            precision={metric ? 2 : 0}
            optional
            placeholder={metric ? '2.5' : '85'}
            className="max-w-32"
          />
          <span className="label">{metric ? 'L' : 'oz'}</span>
        </div>
      </div>
      <Actions canSave={value !== undefined} hasValue={ml !== undefined} onClear={() => void save(date, 'waterMl', undefined, onDone)} onCancel={onDone} />
    </form>
  )
}
