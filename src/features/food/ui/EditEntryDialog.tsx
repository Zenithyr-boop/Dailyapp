import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import type { FoodEntry, MealSlot, Portion, Profile } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import { inputClass, NumberField } from '../../train/workouts/fields'
import { deleteEntry, getEntry, setEntryValues, updateEntry } from '../foodLogRepo'
import { CUSTOM_FOOD_PREFIX, getCustomFood, getFood, updateCustomFood } from '../foodsRepo'
import { foodFromPortion, formatKcal, lacksMacros, MEAL_SLOTS, mealName, type Food, type Macro } from '../nutrition'
import { PortionDialog } from './PortionDialog'

/**
 * Edit or remove a logged entry. Entries from a food edit their amount; quick logs
 * (and `macros`) edit the numbers: calories, plus optional protein, carbs and fat.
 */
export function EditEntryDialog({
  id,
  profile,
  units,
  macros,
  onMacros,
  onClose,
}: {
  id: string
  profile: Profile
  units: UnitSystem
  /** Open on the calories + macros fields ("Add macros"). */
  macros?: boolean
  onMacros: () => void
  onClose: () => void
}) {
  const data = useLiveQuery(async () => {
    const entry = await getEntry(id)
    if (!entry) return { entry: undefined, food: undefined }
    const stored = entry.foodId ? await getFood(entry.foodId) : undefined
    // The food as it is now, with the values the entry was logged with.
    const fromEntry = foodFromPortion(entry)
    const food: Food | undefined = fromEntry && { ...fromEntry, servings: stored?.servings ?? fromEntry.servings, source: stored?.source ?? fromEntry.source }
    return { entry, food }
  }, [id])

  if (!data) return null
  const { entry, food } = data
  if (!entry) {
    return (
      <Dialog title="Not found" onClose={onClose}>
        <p className="text-muted">This entry was removed.</p>
        <Button onClick={onClose}>Close</Button>
      </Dialog>
    )
  }

  async function remove() {
    await deleteEntry(id)
    onClose()
  }

  async function save(portion: Portion, meal: MealSlot) {
    await updateEntry(id, portion, meal)
    onClose()
  }

  // Foods without a weight ("1 plate") are edited by their numbers too.
  if (!food || macros || entry.serving?.nominal) {
    return <ValuesDialog entry={entry} profile={profile} onRemove={remove} onClose={onClose} />
  }
  return (
    <PortionDialog
      food={food}
      initial={entry}
      meal={entry.meal}
      profile={profile}
      units={units}
      submitLabel="Save"
      onSubmit={(p, meal) => void save(p, meal)}
      onAddMacros={lacksMacros(entry) ? onMacros : undefined}
      onDelete={() => void remove()}
      onClose={onClose}
    />
  )
}

const MACRO_FIELDS: { key: Macro; label: string }[] = [
  { key: 'proteinG', label: 'Protein' },
  { key: 'carbsG', label: 'Carbs' },
  { key: 'fatG', label: 'Fat' },
]

/** Calories (required) and optional macros of an entry; empty macros stay "unknown". */
function ValuesDialog({ entry, profile, onRemove, onClose }: { entry: FoodEntry; profile: Profile; onRemove: () => Promise<void>; onClose: () => void }) {
  const id = useId()
  const known = (m: Macro) => (entry.missing?.includes(m) ? undefined : entry[m])
  const [kcal, setKcal] = useState<number | undefined>(entry.kcal)
  const [values, setValues] = useState<Record<Macro, number | undefined>>({ proteinG: known('proteinG'), carbsG: known('carbsG'), fatG: known('fatG') })
  const [meal, setMeal] = useState(entry.meal)
  const customId = entry.foodId?.startsWith(CUSTOM_FOOD_PREFIX) ? entry.foodId : undefined
  const custom = useLiveQuery(async () => (customId ? ((await getCustomFood(customId)) ?? null) : null), [customId])
  const canUpdateFood = !!custom && custom.servings[0]?.nominal === true
  const [updateFood, setUpdateFood] = useState(true)
  const firstMissing = MACRO_FIELDS.find((f) => values[f.key] === undefined)?.key

  async function save() {
    if (kcal === undefined) return
    await setEntryValues(entry.id, { kcal, ...values })
    if (meal !== entry.meal) {
      const updated = await getEntry(entry.id)
      if (updated) await updateEntry(entry.id, updated, meal)
    }
    // A food saved from a quick log: keep its numbers for next time too.
    if (canUpdateFood && updateFood && custom) {
      const per = entry.servings && entry.servings > 0 ? entry.servings : 1
      const missing = MACRO_FIELDS.map((f) => f.key).filter((m) => values[m] === undefined)
      await updateCustomFood(custom.id, {
        name: custom.name,
        brand: custom.brand,
        barcode: custom.barcode,
        servings: custom.servings,
        per100: { kcal: kcal / per, proteinG: (values.proteinG ?? 0) / per, carbsG: (values.carbsG ?? 0) / per, fatG: (values.fatG ?? 0) / per },
        missing,
      })
    }
    onClose()
  }

  return (
    <Dialog title={entry.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div>
          <label htmlFor={`${id}-kcal`} className="label">
            Calories (kcal)
          </label>
          <NumberField id={`${id}-kcal`} className="mt-1" value={kcal} onChange={setKcal} min={0} max={10000} optional />
        </div>
        <fieldset>
          <legend className="label">Macros (optional)</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {MACRO_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`${id}-${f.key}`} className="text-sm text-muted">
                  {f.label} (g)
                </label>
                <NumberField
                  id={`${id}-${f.key}`}
                  className="mt-1"
                  value={values[f.key]}
                  onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  min={0}
                  max={1000}
                  precision={1}
                  optional
                  placeholder="?"
                  autoFocus={f.key === firstMissing}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">Leave a box empty if you don’t know it.</p>
        </fieldset>
        <div>
          <label htmlFor={`${id}-meal`} className="label">
            Meal
          </label>
          <select id={`${id}-meal`} value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)} className={`${inputClass} mt-1`}>
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {mealName(m, profile)}
              </option>
            ))}
          </select>
        </div>
        {canUpdateFood && (
          <label className="flex min-h-touch items-center gap-3">
            <input type="checkbox" className="size-5 accent-accent" checked={updateFood} onChange={(e) => setUpdateFood(e.target.checked)} />
            <span>Also update “{custom!.name}” for next time</span>
          </label>
        )}
        <p className="text-sm text-muted">
          {kcal !== undefined ? `${formatKcal(kcal)} kcal` : 'Calories are needed.'}
        </p>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={kcal === undefined}>
            Save
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => void onRemove()}>
          Remove from log
        </Button>
      </form>
    </Dialog>
  )
}
