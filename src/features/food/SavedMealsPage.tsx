import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import type { Portion } from '../../lib/db'
import { IconButton, inputClass, NumberField } from '../train/workouts/fields'
import { useUnits } from '../profile/units'
import { createSimpleMeal, deleteSavedMeal, FOOD_NAME_MAX, getSavedMeal, listSavedMeals, updateSavedMeal } from './foodsRepo'
import { describeAmount, formatKcal, sumTotals } from './nutrition'
import { MacroLine } from './ui/TotalsBars'

function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
    >
      <ChevronLeftIcon size={18} />
      {label}
    </Link>
  )
}

/** Saved meals: foods eaten together, logged in one tap from Add food. */
export function SavedMealsPage() {
  const meals = useLiveQuery(listSavedMeals, [])
  return (
    <>
      <Back to="/food" label="Food" />
      <PageHeader title="Saved meals" />
      <p className="mb-4 text-muted">
        Log a meal in one tap: from the Food tab’s box (type its name) or Add food → Saved meals. Save the foods you ate together from a meal’s menu (⋯ → Save as a
        meal), or make one here from just a name and its calories.
      </p>
      <NewSimpleMeal />
      <Panel title="Your meals" aside={meals ? String(meals.length) : undefined}>
        {!meals ? (
          <p className="text-muted">Loading…</p>
        ) : meals.length ? (
          <ul className="-mx-4 -my-4">
            {meals.map((m) => {
              const totals = sumTotals(m.items)
              return (
                <li key={m.id} className="border-b border-line-soft last:border-b-0">
                  <Link to={`/food/meals/${m.id}`} className="group flex min-h-touch items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold group-hover:text-accent">{m.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {m.items.length} food{m.items.length === 1 ? '' : 's'} · {formatKcal(totals.kcal)} kcal · <MacroLine totals={totals} />
                      </span>
                    </span>
                    <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted">No saved meals yet.</p>
        )}
      </Panel>
    </>
  )
}

/** A meal from just a name and its total calories; macros optional under "More details". */
function NewSimpleMeal() {
  const id = useId()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number | undefined>()
  const [macros, setMacros] = useState<{ proteinG?: number; carbsG?: number; fatG?: number }>({})
  const [saved, setSaved] = useState('')
  const valid = name.trim() !== '' && kcal !== undefined && kcal > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await createSimpleMeal(name, { kcal: kcal!, ...macros })
    setSaved(`Saved “${name.trim()}”.`)
    setName('')
    setKcal(undefined)
    setMacros({})
  }

  return (
    <Panel title="New meal" className="mb-4">
      <form onSubmit={(e) => void save(e)} className="space-y-3">
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
          <div>
            <label htmlFor={`${id}-name`} className="label">
              Name
            </label>
            <input
              id={`${id}-name`}
              className={`${inputClass} mt-1`}
              value={name}
              maxLength={FOOD_NAME_MAX}
              placeholder="e.g. Usual breakfast"
              onChange={(e) => {
                setName(e.target.value)
                setSaved('')
              }}
            />
          </div>
          <div>
            <label htmlFor={`${id}-kcal`} className="label">
              Calories
            </label>
            <NumberField id={`${id}-kcal`} className="mt-1" value={kcal} onChange={setKcal} min={0} max={10000} optional placeholder="kcal" />
          </div>
        </div>
        <details className="border border-line">
          <summary className="flex min-h-touch cursor-pointer items-center px-3 text-sm font-semibold text-muted hover:text-accent">More details (macros)</summary>
          <div className="grid grid-cols-3 gap-2 border-t border-line-soft p-3">
            {(
              [
                ['proteinG', 'Protein'],
                ['carbsG', 'Carbs'],
                ['fatG', 'Fat'],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`${id}-${k}`} className="text-sm text-muted">
                  {label} (g)
                </label>
                <NumberField
                  id={`${id}-${k}`}
                  className="mt-1"
                  value={macros[k]}
                  onChange={(v) => setMacros((m) => ({ ...m, [k]: v }))}
                  min={0}
                  max={1000}
                  precision={1}
                  optional
                  placeholder="?"
                />
              </div>
            ))}
          </div>
        </details>
        <Button type="submit" disabled={!valid} className="w-full sm:w-auto">
          Save meal
        </Button>
        <p role="status" className={saved ? 'text-sm' : 'sr-only'}>
          {saved}
        </p>
      </form>
    </Panel>
  )
}

/** Rename a saved meal, remove foods from it, or delete it. Changes apply on Save. */
export function SavedMealPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const ids = useId()
  const units = useUnits()
  const [draft, setDraft] = useState<{ name: string; items: { key: string; portion: Portion }[] }>()
  const [missing, setMissing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    void getSavedMeal(id).then((m) => {
      if (!m) setMissing(true)
      else setDraft({ name: m.name, items: m.items.map((portion) => ({ key: crypto.randomUUID(), portion })) })
    })
  }, [id])

  if (missing) {
    return (
      <>
        <Back to="/food/meals" label="Saved meals" />
        <PageHeader title="Meal not found" />
        <p className="text-muted">It may have been deleted.</p>
      </>
    )
  }
  if (!draft) return <p className="text-muted">Loading…</p>

  const totals = sumTotals(draft.items.map((i) => i.portion))

  async function save() {
    if (!draft) return
    await updateSavedMeal(id, draft.name, draft.items.map((i) => i.portion))
    navigate('/food/meals')
  }

  async function remove() {
    await deleteSavedMeal(id)
    navigate('/food/meals', { replace: true })
  }

  return (
    <>
      <Back to="/food/meals" label="Saved meals" />
      <PageHeader title="Edit meal" />
      <div className="space-y-4">
        <div>
          <label htmlFor={`${ids}-name`} className="label">
            Name
          </label>
          <input
            id={`${ids}-name`}
            className={`${inputClass} mt-1`}
            value={draft.name}
            maxLength={FOOD_NAME_MAX}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <Panel title="Foods" aside={`${formatKcal(totals.kcal)} kcal`}>
          {draft.items.length ? (
            <ul className="-mx-4 -my-4">
              {draft.items.map(({ key, portion: p }) => (
                <li key={key} className="flex items-center gap-2 border-b border-line-soft py-1 pl-4 pr-1 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {describeAmount(p, units === 'imperial' ? 'oz' : 'g')} · {formatKcal(p.kcal)} kcal
                    </span>
                  </span>
                  <IconButton label={`Remove ${p.name}`} onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.key !== key) })}>
                    <TrashIcon size={18} />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No foods left. Saving keeps an empty meal; delete it instead?</p>
          )}
        </Panel>
        <p className="text-sm text-muted">
          <MacroLine totals={totals} />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1 sm:flex-none" onClick={() => void save()}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => navigate('/food/meals')}>
            Cancel
          </Button>
          <Button variant="secondary" className="sm:ml-auto" onClick={() => setConfirmDelete(true)}>
            Delete meal
          </Button>
        </div>
      </div>
      {confirmDelete && (
        <Dialog title={`Delete “${draft.name}”?`} onClose={() => setConfirmDelete(false)}>
          <p>Food you already logged from it stays in your log.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
