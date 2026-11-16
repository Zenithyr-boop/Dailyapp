import { PlusIcon } from '../../../components/icons'
import { Tag } from '../../train/library/Chip'
import { describeAmount, formatKcal, lacksMacros } from '../nutrition'
import { TIER_LABEL, type FoodResult } from './useFoodSearch'

/** "1 medium · 105 kcal" — what one tap logs. */
function resultLine(r: FoodResult, unit: 'g' | 'oz'): string {
  if (r.kind === 'meal') {
    const n = r.meal.items.length
    return `${n > 1 ? `${n} foods · ` : ''}${formatKcal(r.kcal)} kcal`
  }
  const amount = r.portion.serving && r.portion.servings === 1 ? r.portion.serving.label : describeAmount(r.portion, unit)
  return [r.food.brand, amount, `${formatKcal(r.portion.kcal)} kcal`].filter(Boolean).join(' · ')
}

/**
 * Search results that log in one tap. Each row shows the default serving and its
 * calories, and a small label for where it came from.
 */
export function FoodResults({ results, unit, onPick, label }: { results: FoodResult[]; unit: 'g' | 'oz'; onPick: (r: FoodResult) => void; label?: string }) {
  return (
    <ul className="-mx-4 -my-4" aria-label={label}>
      {results.map((r) => {
        const name = r.kind === 'meal' ? r.meal.name : r.food.name
        const incomplete = r.kind === 'food' && r.tier === 'packaged' && lacksMacros(r.food)
        return (
          <li key={r.key} className="border-b border-line-soft last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(r)}
              className="group flex min-h-touch w-full items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug group-hover:text-accent">{name}</span>
                <span className="mt-0.5 block truncate text-sm text-muted tabular-nums">{resultLine(r, unit)}</span>
              </span>
              <Tag tone={r.tier === 'recent' || r.tier === 'custom' || r.tier === 'favorite' || r.tier === 'meal' ? 'accent' : 'muted'}>
                {incomplete ? 'Incomplete' : TIER_LABEL[r.tier]}
              </Tag>
              <span className="grid size-8 shrink-0 place-items-center border border-panel-edge text-muted group-hover:border-accent group-hover:text-accent" aria-hidden="true">
                <PlusIcon size={16} />
              </span>
              <span className="sr-only">, log it</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
