import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { StarIcon } from '../../../components/icons'
import type { MealSlot, Portion, Profile } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import { inputClass, NumberField } from '../../train/workouts/fields'
import { isFavorite, setFavorite } from '../foodsRepo'
import {
  amountOf,
  formatG,
  formatKcal,
  gToOz,
  MEAL_SLOTS,
  mealName,
  missingText,
  ozToG,
  portionOf,
  type Amount,
  type Food,
} from '../nutrition'

const SOURCE_LABEL = { usda: 'USDA', off: 'Open Food Facts', custom: 'Your food' } as const

/** Unit choice: grams, ounces, or one of the food's servings (by index). */
type UnitKey = 'g' | 'oz' | `s${number}`

function initialState(food: Food, initial: Portion | undefined, units: UnitSystem): { unit: UnitKey; qty: number } {
  if (initial) {
    const a = amountOf(initial)
    if ('servings' in a) {
      const i = food.servings.findIndex((s) => s.label === a.serving.label && s.grams === a.serving.grams)
      if (i >= 0) return { unit: `s${i}`, qty: a.servings }
      return { unit: 'g', qty: Math.round(a.servings * a.serving.grams * 10) / 10 }
    }
    return { unit: 'g', qty: a.grams }
  }
  if (food.servings.length) return { unit: 's0', qty: 1 }
  return units === 'imperial' ? { unit: 'oz', qty: 3.5 } : { unit: 'g', qty: 100 }
}

function toAmount(food: Food, unit: UnitKey, qty: number): Amount {
  if (unit === 'g') return { grams: qty }
  if (unit === 'oz') return { grams: ozToG(qty) }
  const serving = food.servings[Number(unit.slice(1))]
  return serving ? { servings: qty, serving } : { grams: qty }
}

interface PortionDialogProps {
  food: Food
  /** Editing a logged entry: its current portion. */
  initial?: Portion
  meal: MealSlot
  profile?: Pick<Profile, 'mealNames'>
  units: UnitSystem
  submitLabel: string
  onSubmit: (portion: Portion, meal: MealSlot) => void
  onDelete?: () => void
  onClose: () => void
}

/** Pick an amount of a food (grams, ounces or servings) and the meal, with live totals. */
export function PortionDialog({ food, initial, meal: initialMeal, profile, units, submitLabel, onSubmit, onDelete, onClose }: PortionDialogProps) {
  const ids = useId()
  const [{ unit, qty }, setAmount] = useState(() => initialState(food, initial, units))
  const [meal, setMeal] = useState(initialMeal)
  const favorite = useLiveQuery(() => isFavorite(food.id), [food.id]) ?? false

  const portion = portionOf(food, toAmount(food, unit, qty))
  const valid = qty > 0

  function changeUnit(next: UnitKey) {
    // Keep the same amount of food when switching between grams and ounces.
    if (unit === 'g' && next === 'oz') setAmount({ unit: next, qty: Math.round(gToOz(qty) * 10) / 10 })
    else if (unit === 'oz' && next === 'g') setAmount({ unit: next, qty: Math.round(ozToG(qty)) })
    else if (next === 'g' || next === 'oz') setAmount({ unit: next, qty: next === 'g' ? Math.round(portion.grams ?? 100) : Math.round(gToOz(portion.grams ?? 100) * 10) / 10 })
    else setAmount({ unit: next, qty: 1 })
  }

  const isServing = unit.startsWith('s')

  return (
    <Dialog title={food.name} onClose={onClose}>
      <div className="-mt-1 flex items-start justify-between gap-3">
        <p className="text-sm text-muted">
          {[food.brand, SOURCE_LABEL[food.source]].filter(Boolean).join(' · ')}
          {food.barcode ? <span className="block tabular-nums">Barcode {food.barcode}</span> : null}
        </p>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
          title={favorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={() => void setFavorite(food, !favorite)}
          className={`-mr-2 -mt-2 grid size-touch shrink-0 place-items-center hover:text-accent ${favorite ? 'text-accent' : 'text-muted'}`}
        >
          <StarIcon filled={favorite} size={22} />
        </button>
      </div>

      {food.missing?.length ? (
        <div className="border border-line p-3 text-sm" role="note">
          <p>
            Open Food Facts is missing the <strong>{missingText(food.missing)}</strong> for this product, so {food.missing.length > 1 ? 'they count' : 'it counts'} as 0.
          </p>
          <Link
            to={`/food/foods/new?from=${encodeURIComponent(food.id)}`}
            className="mt-2 inline-flex min-h-touch items-center font-display font-bold uppercase tracking-wider text-accent hover:text-text"
          >
            Fill in the gaps
          </Link>
        </div>
      ) : null}
      {food.kcalFromKj && !food.missing?.includes('kcal') ? (
        <p className="text-sm text-muted">Calories worked out from kJ (the label lists only kJ).</p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <div>
          <label htmlFor={`${ids}-qty`} className="label">
            {isServing ? 'Servings' : 'Amount'}
          </label>
          <NumberField
            id={`${ids}-qty`}
            className="mt-1"
            value={qty}
            onChange={(v) => setAmount((s) => ({ ...s, qty: v ?? s.qty }))}
            min={0}
            max={isServing ? 50 : unit === 'oz' ? 200 : 5000}
            precision={isServing ? 2 : 1}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-unit`} className="label">
            Unit
          </label>
          <select id={`${ids}-unit`} value={unit} onChange={(e) => changeUnit(e.target.value as UnitKey)} className={`${inputClass} mt-1`}>
            {food.servings.map((s, i) => (
              <option key={`${s.label}-${i}`} value={`s${i}`}>
                {s.label} ({formatG(s.grams)} g)
              </option>
            ))}
            <option value="g">grams</option>
            <option value="oz">ounces</option>
          </select>
        </div>
      </div>

      <div aria-live="polite" className="grid grid-cols-4 gap-2 border-y border-line-soft py-3 text-center">
        <Stat label="kcal" value={formatKcal(portion.kcal)} />
        <Stat label="Protein" value={`${formatG(portion.proteinG)} g`} />
        <Stat label="Carbs" value={`${formatG(portion.carbsG)} g`} />
        <Stat label="Fat" value={`${formatG(portion.fatG)} g`} />
      </div>
      <p className="-mt-2 text-xs text-muted">
        {formatG(portion.grams ?? 0)} g · per 100 g: {formatKcal(food.per100.kcal)} kcal, P {formatG(food.per100.proteinG)} · C {formatG(food.per100.carbsG)} · F{' '}
        {formatG(food.per100.fatG)}
      </p>

      <div>
        <label htmlFor={`${ids}-meal`} className="label">
          Meal
        </label>
        <select id={`${ids}-meal`} value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)} className={`${inputClass} mt-1`}>
          {MEAL_SLOTS.map((m) => (
            <option key={m} value={m}>
              {mealName(m, profile)}
            </option>
          ))}
        </select>
      </div>

      {food.source === 'custom' && (
        <Link to={`/food/foods/${encodeURIComponent(food.id)}/edit`} className="inline-flex min-h-touch items-center text-sm text-accent underline underline-offset-2 hover:text-text">
          Edit this food
        </Link>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button disabled={!valid} onClick={() => onSubmit(portion, meal)} className="flex-1">
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {onDelete && (
        <Button variant="secondary" onClick={onDelete} className="w-full">
          Remove from log
        </Button>
      )}
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-bold tabular-nums leading-none">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  )
}
