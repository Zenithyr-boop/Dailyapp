import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import type { CustomMovement } from '../../../lib/db'
import { CATEGORIES, EQUIPMENT, label, MUSCLES } from './catalog'
import { Chip } from './Chip'
import {
  createCustomMovement,
  getCustomMovement,
  NAME_MAX,
  updateCustomMovement,
  type CustomMovementFields,
} from './customMovements'
import { BackToLibrary } from './MovementDetailPage'
import { TRACKING_LABELS, TRACKING_TYPES, type TrackingType } from './types'

const inputClass =
  'mt-1 block min-h-touch w-full border border-line bg-bg px-3 text-text placeholder:text-faint focus:border-accent focus:outline-none'

const TRACKING_HINTS: Record<TrackingType, string> = {
  weight_reps: 'e.g. bench press',
  bodyweight_reps: 'e.g. push-ups',
  assisted: 'assistance is subtracted from body weight',
  time: 'e.g. plank',
  distance_time: 'e.g. running',
}

/** Create (`/train/movements/new`) or edit (`/train/movements/:id/edit`) a custom movement. */
export function MovementFormPage() {
  const { id } = useParams()
  // `null` = looked up and not found; `undefined` = still loading.
  const existing = useLiveQuery(async () => (id ? ((await getCustomMovement(id)) ?? null) : null), [id])

  if (id && existing === undefined) return <BackToLibrary />
  if (id && !existing) {
    return (
      <>
        <BackToLibrary />
        <PageHeader title="Not found" />
        <p className="text-muted">Only your own movements can be edited.</p>
      </>
    )
  }
  return <MovementForm key={id ?? 'new'} existing={existing ?? undefined} />
}

function MovementForm({ existing }: { existing?: CustomMovement }) {
  const id = useId()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState(existing?.name ?? params.get('name') ?? '')
  const [tracking, setTracking] = useState<TrackingType>(existing?.tracking ?? 'weight_reps')
  const [category, setCategory] = useState(existing?.category ?? 'strength')
  const [equipment, setEquipment] = useState(existing?.equipment ?? 'barbell')
  const [primary, setPrimary] = useState<string[]>(existing?.primaryMuscles ?? [])
  const [secondary, setSecondary] = useState<string[]>(existing?.secondaryMuscles ?? [])
  const [instructions, setInstructions] = useState(existing?.instructions.join('\n') ?? '')
  const [saving, setSaving] = useState(false)

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const fields: CustomMovementFields = {
      name,
      tracking,
      category,
      equipment,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      instructions: instructions.split('\n'),
    }
    const movementId = existing ? existing.id : await createCustomMovement(fields)
    if (existing) await updateCustomMovement(existing.id, fields)
    navigate(`/train/movements/${encodeURIComponent(movementId)}`, { replace: true })
  }

  return (
    <>
      <BackToLibrary />
      <PageHeader title={existing ? 'Edit movement' : 'New movement'} />
      <Panel>
        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <div>
            <label htmlFor={`${id}-name`} className="label">
              Name
            </label>
            <input
              id={`${id}-name`}
              required
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landmine press"
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className="label">Log it as</legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {TRACKING_TYPES.map((t) => (
                <label
                  key={t}
                  className={`flex min-h-touch cursor-pointer flex-col justify-center border px-3 py-1.5 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                    tracking === t ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:text-text'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-tracking`}
                    value={t}
                    checked={tracking === t}
                    onChange={() => setTracking(t)}
                    className="sr-only"
                  />
                  <span className="font-display font-semibold uppercase tracking-wider">{TRACKING_LABELS[t]}</span>
                  <span className="text-xs">{TRACKING_HINTS[t]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-equipment`} className="label">
                Equipment
              </label>
              <select id={`${id}-equipment`} value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputClass}>
                {EQUIPMENT.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-category`} className="label">
                Category
              </label>
              <select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <MuscleField
            legend="Main muscles"
            selected={primary}
            onToggle={(m) => {
              setPrimary((p) => toggle(p, m))
              setSecondary((s) => s.filter((x) => x !== m))
            }}
          />
          <MuscleField
            legend="Also works (optional)"
            selected={secondary}
            disabled={primary}
            onToggle={(m) => setSecondary((s) => toggle(s, m))}
          />

          <div>
            <label htmlFor={`${id}-instructions`} className="label">
              Instructions (optional, one step per line)
            </label>
            <textarea
              id={`${id}-instructions`}
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className={`${inputClass} py-2`}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {existing ? 'Save' : 'Create'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    </>
  )
}

function MuscleField({
  legend,
  selected,
  disabled = [],
  onToggle,
}: {
  legend: string
  selected: string[]
  disabled?: string[]
  onToggle: (muscle: string) => void
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {MUSCLES.filter((m) => !disabled.includes(m)).map((m) => (
          <Chip key={m} selected={selected.includes(m)} onClick={() => onToggle(m)}>
            {label(m)}
          </Chip>
        ))}
      </div>
    </fieldset>
  )
}
