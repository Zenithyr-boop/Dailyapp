import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Tag } from '../train/library/Chip'
import { listCustomFoods } from './foodsRepo'
import { formatG, formatKcal } from './nutrition'

/** The user's own foods (and completed copies of packaged foods). */
export function MyFoodsPage() {
  const foods = useLiveQuery(listCustomFoods, [])
  return (
    <>
      <Link
        to="/food"
        className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        Food
      </Link>
      <PageHeader
        title="My foods"
        aside={
          <Link
            to="/food/foods/new"
            className="inline-flex min-h-touch items-center gap-2 border border-panel-edge px-4 font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
          >
            <PlusIcon size={18} />
            New
          </Link>
        }
      />
      <Panel title="Your foods" aside={foods ? String(foods.length) : undefined}>
        {!foods ? (
          <p className="text-muted">Loading…</p>
        ) : foods.length ? (
          <ul className="-mx-4 -my-4">
            {foods.map((f) => (
              <li key={f.id} className="border-b border-line-soft last:border-b-0">
                <Link to={`/food/foods/${encodeURIComponent(f.id)}/edit`} className="group flex min-h-touch items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold group-hover:text-accent">{f.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {[f.brand, `${formatKcal(f.per100.kcal)} kcal · P ${formatG(f.per100.proteinG)} · C ${formatG(f.per100.carbsG)} · F ${formatG(f.per100.fatG)} per 100 g`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {f.basedOn && <Tag>Fixed product</Tag>}
                  <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Foods you create show up here. They sync to your account when you’re signed in.</p>
        )}
      </Panel>
    </>
  )
}
