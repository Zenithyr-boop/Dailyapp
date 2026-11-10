import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { BarcodeIcon, BoltIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import type { MealSlot, Portion } from '../../lib/db'
import { Tag } from '../train/library/Chip'
import { inputClass } from '../train/workouts/fields'
import { useUnits } from '../profile/units'
import { logPortion, recentFoods } from './foodLogRepo'
import { customToFood, getFood, listCustomFoods, listFavorites, listSavedMeals, logSavedMeal } from './foodsRepo'
import { loadUsdaFoods } from './library/catalog'
import { formatG, formatKcal, MEAL_SLOTS, mealName, sumTotals, type Food } from './nutrition'
import { cachedProducts, offErrorText, searchProducts } from './off'
import { BOOST, indexFood, searchFoods } from './search'
import { dayLabel, useFoodParams, useOverlay, useProfile } from './ui/hooks'
import { PortionDialog } from './ui/PortionDialog'
import { QuickAddDialog } from './ui/QuickAddDialog'
import { ScannerDialog } from './ui/ScannerDialog'

const TABS = [
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favourites' },
  { id: 'mine', label: 'My foods' },
  { id: 'meals', label: 'Saved meals' },
] as const
type Tab = (typeof TABS)[number]['id']

const SOURCE_TAG = { usda: undefined, off: 'Packaged', custom: 'Yours' } as const

/** Add food to a meal: search everything on the device, packaged foods on request, scan, quick add. */
export function AddFoodPage() {
  const { params, setParams, date, today, meal } = useFoodParams()
  const overlay = useOverlay()
  const profile = useProfile()
  const units = useUnits()
  const searchId = useId()
  const [status, setStatus] = useState('')

  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'recent') as Tab
  const foodId = params.get('food')

  function setParam(key: string, value: string | undefined) {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p, { replace: true, preventScrollReset: true })
  }

  // ---- Local search index: USDA list + your foods + favourites + products seen before ----
  const [usda, setUsda] = useState<Food[]>()
  const [usdaError, setUsdaError] = useState(false)
  useEffect(() => {
    loadUsdaFoods().then(setUsda, () => setUsdaError(true))
  }, [])
  const mine = useLiveQuery(listCustomFoods, [])
  const favorites = useLiveQuery(listFavorites, [])
  const seen = useLiveQuery(cachedProducts, [])
  const index = useMemo(() => {
    const own = (mine ?? []).map((c) => indexFood(customToFood(c), BOOST.custom))
    const favs = (favorites ?? []).map((f) =>
      indexFood({ ...f.food, source: f.id.startsWith('off-') ? 'off' : f.id.startsWith('custom-') ? 'custom' : 'usda' }, BOOST.favorite),
    )
    return [...own, ...favs, ...(usda ?? []).map((f) => indexFood(f)), ...(seen ?? []).map((f) => indexFood(f, BOOST.off))]
  }, [mine, favorites, usda, seen])

  // ---- Packaged foods (Open Food Facts): only when asked ----
  const [packaged, setPackaged] = useState<{ q: string; foods: Food[]; count: number; page: number; loading: boolean; error?: string }>()
  const packagedFor = packaged?.q === query.trim() ? packaged : undefined

  // Products just found online are listed under Packaged foods, not twice.
  const results = useMemo(() => {
    const online = new Set(packagedFor?.foods.map((f) => f.id))
    return searchFoods(index, deferredQuery, 40 + online.size).filter((f) => !online.has(f.id)).slice(0, 40)
  }, [index, deferredQuery, packagedFor])

  async function searchPackaged(page = 1) {
    const q = query.trim()
    if (q.length < 2) return
    setPackaged((prev) => ({ q, foods: page > 1 && prev?.q === q ? prev.foods : [], count: prev?.q === q ? prev.count : 0, page, loading: true }))
    try {
      const result = await searchProducts(q, page)
      setPackaged((prev) => ({
        q,
        foods: page > 1 && prev?.q === q ? [...prev.foods, ...result.foods.filter((f) => !prev.foods.some((p) => p.id === f.id))] : result.foods,
        count: result.count,
        page,
        loading: false,
      }))
    } catch (error) {
      setPackaged((prev) => ({ q, foods: prev?.q === q ? prev.foods : [], count: prev?.count ?? 0, page: prev?.page ?? 1, loading: false, error: offErrorText(error) }))
    }
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    void searchPackaged()
  }

  // ---- Logging ----
  const mealLabel = mealName(meal, profile)
  async function log(portion: Portion, toMeal: MealSlot) {
    await logPortion(date, toMeal, portion)
    overlay.close('food', 'quick')
    setStatus(`Added ${portion.name} (${formatKcal(portion.kcal)} kcal) to ${mealName(toMeal, profile)}.`)
  }

  const backTo = `/food${date !== today ? `?date=${date}` : ''}`

  return (
    <>
      <Link
        to={backTo}
        className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        Food
      </Link>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label mb-1">{dayLabel(date, today)}</p>
          <h1 className="text-4xl font-extrabold leading-none">Add food</h1>
        </div>
        <div className="w-40">
          <label htmlFor={`${searchId}-meal`} className="label">
            Meal
          </label>
          <select id={`${searchId}-meal`} value={meal} onChange={(e) => setParam('meal', e.target.value)} className={`${inputClass} mt-1`}>
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {mealName(m, profile)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="space-y-4">
        <form role="search" onSubmit={submitSearch}>
          <label htmlFor={searchId} className="sr-only">
            Search foods
          </label>
          <div className="flex border border-line bg-bg focus-within:border-accent">
            <SearchIcon size={20} className="ml-3 shrink-0 self-center text-muted" />
            <input
              id={searchId}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search foods"
              value={query}
              onChange={(e) => setParam('q', e.target.value || undefined)}
              className="min-h-touch min-w-0 flex-1 bg-transparent px-3 text-text placeholder:text-faint focus:outline-none"
            />
          </div>
          <p className="mt-1 text-sm text-muted">Press Enter to also search packaged foods.</p>
        </form>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => overlay.open('scan')}>
            <BarcodeIcon size={20} />
            Scan
          </Button>
          <Button variant="secondary" onClick={() => overlay.open('quick')}>
            <BoltIcon size={20} />
            Quick add
          </Button>
        </div>

        <p role="status" className={status ? 'border border-panel-edge bg-panel px-4 py-3' : 'sr-only'}>
          {status}{' '}
          {status && (
            <Link to={backTo} className="font-semibold text-accent underline underline-offset-2 hover:text-text">
              Done
            </Link>
          )}
        </p>

        {query.trim() ? (
          <>
            <Panel title="Foods" aside={usda ? `${results.length}${results.length === 40 ? '+' : ''}` : undefined}>
              {usdaError ? (
                <p className="text-muted">Couldn’t load the food list. Check your connection and reload.</p>
              ) : !usda ? (
                <p className="text-muted" role="status">
                  Loading foods…
                </p>
              ) : results.length ? (
                <FoodList foods={results} onPick={(f) => overlay.open('food', f.id)} />
              ) : (
                <p className="text-muted">Nothing on your device matches. Try packaged foods below, or create your own.</p>
              )}
            </Panel>

            <Panel title="Packaged foods" aside="Open Food Facts">
              {!packagedFor ? (
                <Button variant="secondary" className="w-full" onClick={() => void searchPackaged()} disabled={query.trim().length < 2}>
                  Search packaged foods for “{query.trim()}”
                </Button>
              ) : (
                <>
                  {packagedFor.foods.length > 0 && <FoodList foods={packagedFor.foods} onPick={(f) => overlay.open('food', f.id)} />}
                  {packagedFor.loading && (
                    <p role="status" className="mt-2 text-muted">
                      Searching Open Food Facts…
                    </p>
                  )}
                  {packagedFor.error && (
                    <div role="alert" className="mt-2">
                      <p>{packagedFor.error}</p>
                      <Button variant="secondary" className="mt-2" onClick={() => void searchPackaged(packagedFor.page)}>
                        Try again
                      </Button>
                    </div>
                  )}
                  {!packagedFor.loading && !packagedFor.error && packagedFor.foods.length === 0 && (
                    <p className="text-muted">No packaged foods found. Try fewer words, or scan the barcode.</p>
                  )}
                  {!packagedFor.loading && packagedFor.foods.length > 0 && packagedFor.foods.length < packagedFor.count && (
                    <Button variant="secondary" className="mt-4 w-full" onClick={() => void searchPackaged(packagedFor.page + 1)}>
                      Show more
                    </Button>
                  )}
                </>
              )}
            </Panel>

            <Link
              to={`/food/foods/new?name=${encodeURIComponent(query.trim())}`}
              className="inline-flex min-h-touch items-center gap-1 text-accent underline underline-offset-2 hover:text-text"
            >
              Create “{query.trim()}” as your own food
            </Link>
          </>
        ) : (
          <Tabs tab={tab} onTab={(t) => setParam('tab', t === 'recent' ? undefined : t)}>
            {tab === 'recent' && <RecentTab onPick={(f) => overlay.open('food', f.id)} />}
            {tab === 'favorites' && (
              <ListOrEmpty
                foods={favorites?.map((f) => ({ ...f.food, source: f.id.startsWith('off-') ? 'off' : f.id.startsWith('custom-') ? 'custom' : 'usda' }) as Food)}
                empty="No favourites yet. Tap the star on a food to add it here."
                onPick={(f) => overlay.open('food', f.id)}
              />
            )}
            {tab === 'mine' && (
              <>
                <ListOrEmpty foods={mine?.map(customToFood)} empty="You haven’t made any foods yet." onPick={(f) => overlay.open('food', f.id)} />
                <Link
                  to="/food/foods/new"
                  className="mt-4 inline-flex min-h-touch w-full items-center justify-center border border-panel-edge font-display font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
                >
                  Create a food
                </Link>
              </>
            )}
            {tab === 'meals' && (
              <SavedMealsTab
                onLog={async (id, name) => {
                  const n = await logSavedMeal(id, date, meal)
                  setStatus(`Added ${name} (${n} food${n === 1 ? '' : 's'}) to ${mealLabel}.`)
                }}
              />
            )}
          </Tabs>
        )}
      </div>

      {foodId && <FoodLoader id={foodId} meal={meal} units={units} profile={profile} onLog={log} onClose={() => overlay.close('food')} />}
      {params.get('quick') === '1' && <QuickAddDialog meal={meal} profile={profile} onSubmit={(p, m) => void log(p, m)} onClose={() => overlay.close('quick')} />}
      {params.get('scan') === '1' && <ScannerDialog onFound={(f) => overlay.swap('scan', 'food', f.id)} onClose={() => overlay.close('scan')} />}
    </>
  )
}

function FoodLoader({
  id,
  meal,
  units,
  profile,
  onLog,
  onClose,
}: {
  id: string
  meal: MealSlot
  units: 'metric' | 'imperial'
  profile: Parameters<typeof mealName>[1]
  onLog: (p: Portion, meal: MealSlot) => Promise<void>
  onClose: () => void
}) {
  const food = useLiveQuery(async () => (await getFood(id)) ?? null, [id])
  if (food === undefined) return null
  if (food === null) {
    return <PortionMissing onClose={onClose} />
  }
  return (
    <PortionDialog
      key={food.id}
      food={food}
      meal={meal}
      profile={profile}
      units={units}
      submitLabel={`Add to ${mealName(meal, profile)}`}
      onSubmit={(p, m) => void onLog(p, m)}
      onClose={onClose}
    />
  )
}

function PortionMissing({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Food not found" onClose={onClose}>
      <p>This food isn’t on this device any more. Search for it again.</p>
      <Button onClick={onClose}>Close</Button>
    </Dialog>
  )
}

function Tabs({ tab, onTab, children }: { tab: Tab; onTab: (t: Tab) => void; children: ReactNode }) {
  const id = useId()
  function onKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : undefined
    if (next === undefined) return
    e.preventDefault()
    const t = TABS[(next + TABS.length) % TABS.length]!
    onTab(t.id)
    document.getElementById(`${id}-${t.id}`)?.focus()
  }
  return (
    <section className="border border-panel-edge bg-panel">
      <div role="tablist" aria-label="Your foods" onKeyDown={onKey} className="grid grid-cols-4 border-b border-line-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${id}-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => onTab(t.id)}
            className={`min-h-touch border-b-2 px-1 font-display text-xs font-bold uppercase tracking-wider sm:text-sm ${
              tab === t.id ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="p-4">
        {children}
      </div>
    </section>
  )
}

function RecentTab({ onPick }: { onPick: (f: Food) => void }) {
  const recent = useLiveQuery(() => recentFoods(30), [])
  return <ListOrEmpty foods={recent?.map((r) => r.food)} empty="Foods you log show up here." onPick={onPick} />
}

function ListOrEmpty({ foods, empty, onPick }: { foods: Food[] | undefined; empty: string; onPick: (f: Food) => void }) {
  if (!foods) return <p className="text-muted">Loading…</p>
  if (!foods.length) return <p className="text-muted">{empty}</p>
  return <FoodList foods={foods} onPick={onPick} />
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <ul className="-mx-4 -my-4">
      {foods.map((f) => {
        const serving = f.servings[0]
        const tag = SOURCE_TAG[f.source]
        return (
          <li key={f.id} className="border-b border-line-soft last:border-b-0">
            <button type="button" onClick={() => onPick(f)} className="group flex min-h-touch w-full items-center gap-3 px-4 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug group-hover:text-accent">{f.name}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {[
                    f.brand,
                    serving
                      ? `${serving.label} · ${formatKcal((f.per100.kcal * serving.grams) / 100)} kcal`
                      : `100 g · ${formatKcal(f.per100.kcal)} kcal`,
                    `P ${formatG(f.per100.proteinG)} / 100 g`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {f.missing?.length ? <Tag>Incomplete</Tag> : tag ? <Tag tone={f.source === 'custom' ? 'accent' : 'muted'}>{tag}</Tag> : null}
              <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SavedMealsTab({ onLog }: { onLog: (id: string, name: string) => Promise<void> }) {
  const meals = useLiveQuery(listSavedMeals, [])
  if (!meals) return <p className="text-muted">Loading…</p>
  return (
    <>
      {meals.length ? (
        <ul className="-mx-4 -my-4">
          {meals.map((m) => {
            const totals = sumTotals(m.items)
            return (
              <li key={m.id} className="flex items-center gap-2 border-b border-line-soft py-2 pl-4 pr-2 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {m.items.length} food{m.items.length === 1 ? '' : 's'} · {formatKcal(totals.kcal)} kcal
                  </span>
                </span>
                <Button variant="secondary" className="px-3" onClick={() => void onLog(m.id, m.name)} aria-label={`Log ${m.name}`}>
                  Log
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-muted">
          No saved meals yet. On the Food tab, open a meal’s menu (⋯) and choose “Save as a meal”.
        </p>
      )}
      <Link to="/food/meals" className="mt-4 inline-flex min-h-touch items-center text-sm text-accent underline underline-offset-2 hover:text-text">
        Manage saved meals
      </Link>
    </>
  )
}
