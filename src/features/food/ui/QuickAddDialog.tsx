import { useId, useState } from 'react'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import type { MealSlot, Portion, Profile } from '../../../lib/db'
import { inputClass, NumberField } from '../../train/workouts/fields'
import { FOOD_NAME_MAX } from '../foodsRepo'
import { formatKcal, kcalFromMacros, MEAL_SLOTS, mealName, roundTotals } from '../nutrition'

interface QuickAddDialogProps {
  meal: MealSlot
  profile?: Pick<Profile, 'mealNames'>
  onSubmit: (portion: Portion, meal: MealSlot) => void
  onClose: () => void
}

/** Log just calories and macros, without a food. Calories fill in from the macros if left empty. */
export function QuickAddDialog({ meal: initialMeal, profile, onSubmit, onClose }: QuickAddDialogProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number | undefined>()
  const [proteinG, setProtein] = useState<number | undefined>()
  const [carbsG, setCarbs] = useState<number | undefined>()
  const [fatG, setFat] = useState<number | undefined>()
  const [meal, setMeal] = useState(initialMeal)

  const fromMacros = kcalFromMacros({ proteinG: proteinG ?? 0, carbsG: carbsG ?? 0, fatG: fatG ?? 0 })
  const total = kcal ?? fromMacros
  const valid = total > 0 || (proteinG ?? 0) + (carbsG ?? 0) + (fatG ?? 0) > 0

  function submit() {
    const totals = roundTotals({ kcal: total, proteinG: proteinG ?? 0, carbsG: carbsG ?? 0, fatG: fatG ?? 0 })
    onSubmit({ name: name.trim().replace(/\s+/g, ' ').slice(0, FOOD_NAME_MAX) || 'Quick add', ...totals }, meal)
  }

  const macro = (key: string, label: string, value: number | undefined, set: (v: number | undefined) => void) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="label">
        {label} (g)
      </label>
      <NumberField id={`${id}-${key}`} className="mt-1" value={value} onChange={set} min={0} max={1000} precision={1} optional />
    </div>
  )

  return (
    <Dialog title="Quick add" onClose={onClose}>
      <div>
        <label htmlFor={`${id}-name`} className="label">
          Name (optional)
        </label>
        <input
          id={`${id}-name`}
          className={`${inputClass} mt-1`}
          value={name}
          maxLength={FOOD_NAME_MAX}
          placeholder="Quick add"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${id}-kcal`} className="label">
          Calories (kcal)
        </label>
        <NumberField
          id={`${id}-kcal`}
          className="mt-1"
          value={kcal}
          onChange={setKcal}
          min={0}
          max={10000}
          optional
          placeholder={fromMacros > 0 ? String(fromMacros) : '0'}
        />
        {kcal === undefined && fromMacros > 0 && <p className="mt-1 text-sm text-muted">{formatKcal(fromMacros)} kcal from the macros.</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {macro('p', 'Protein', proteinG, setProtein)}
        {macro('c', 'Carbs', carbsG, setCarbs)}
        {macro('f', 'Fat', fatG, setFat)}
      </div>
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
      <div className="flex gap-2 pt-1">
        <Button disabled={!valid} onClick={submit} className="flex-1">
          Add
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}
