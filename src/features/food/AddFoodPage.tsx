import { useLiveQuery } from 'dexie-react-hooks'
import { ListSkeleton } from '../../components/Skeleton'
import { useDeferredValue, useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { BarcodeIcon, BoltIcon, ChevronLeftIcon, SearchIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import type { MealSlot, Portion } from '../../lib/db'
import { inputClass } from '../train/workouts/fields'
import { useUnits } from '../profile/units'
import { recentFoods } from './foodLogRepo'
import { customToFood, getFood, listCustomFoods, listFavorites, listSavedMeals } from './foodsRepo'
import { logMeal, logOne, undoLogged, type Logged } from './logActions'
import { MEAL_SLOTS, mealName, sumTotals, type Food } from './nutrition'
import { offErrorText, searchProducts } from './off'
import { EditEntryDialog } from './ui/EditEntryDialog'
import { FoodResults } from './ui/FoodResults'
import { dayLabel, useFoodParams, useOverlay, useProfile } from './ui/hooks'
import { LoggedBar } from './ui/LoggedBar'
import { PortionDialog } from './ui/PortionDialog'
import { QuickAddDialog } from './ui/QuickAddDialog'
import { ScannerDialog } from './ui/ScannerDialog'
import { foodResult, sourceFavorite, useFoodSearch, type FoodResult } from './ui/useFoodSearch'

const TABS = [
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favourites' },
  { id: 'mine', label: 'My foods' },
  { id: 'meals', label: 'Saved meals' },
] as const
type Tab = (typeof TABS)[number]['id']

/**
 * Add food to a meal: one search over everything on the device (your recents and
 * foods first, then whole foods and dishes), packaged foods on request, scan,
 * quick log. Tapping a result logs its usual serving, with Undo and "Adjust amount".
 */
export function AddFoodPage() {
  const { params, setParams, date, today, meal } = useFoodParams()
  const overlay = useOverlay()
  const profile = useProfile()
  const units = useUnits()
  const unit = units === 'imperial' ? 'oz' : 'g'
  const searchId = useId()
  const [logged, setLogged] = useState<{ item: Logged; undone?: boolean }>()

  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'recent') as Tab
  const foodId = params.get('food')
  const entryId = params.get('entry')

  function setParam(key: string, value: string | undefined) {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p, { replace: true, preventScrollReset: true })
  }

  function openEntry(id: string, macros = false) {
    const p = new URLSearchParams(params)
    p.set('entry', id)
    if (macros) p.set('macros', '1')
    else p.delete('macros')
    setParams(p)
  }

  function closeEntry() {
    const p = new URLSearchParams(params)
    p.delete('entry')
    p.delete('macros')
    setParams(p, { replace: true })
  }

  const { results, ready, error } = useFoodSearch(deferredQuery, 40)

  // ---- Packaged foods (Open Food Facts): only when asked, or when nothing else matches ----
  const [packaged, setPackaged] = useState<{ q: string; foods: Food[]; count: number; page: number; loading: boolean; error?: string }>()
  const packagedFor = packaged?.q === query.trim() ? packaged : undefined

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
    } catch (e) {
      setPackaged((prev) => ({ q, foods: prev?.q === q ? prev.foods : [], count: prev?.count ?? 0, page: prev?.page ?? 1, loading: false, error: offErrorText(e) }))
    }
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    // Enter asks Open Food Facts only when nothing on the device matches.
    if (ready && results.length === 0) void searchPackaged()
  }

  // ---- Logging ----
  async function pick(r: FoodResult) {
    const item = r.kind === 'meal' ? await logMeal(date, meal, r.meal.id) : await logOne(date, meal, r.portion)
    if (item) setLogged({ item })
  }

  async function logPortionFromDialog(portion: Portion, toMeal: MealSlot) {
    const item = await logOne(date, toMeal, portion)
    overlay.close('food', 'quick')
    setLogged({ item })
  }

  async function undo() {
    if (!logged) return
    await undoLogged(logged.item)
    setLogged({ ...logged, undone: true })
  }

  const backTo = `/food${date !== today ? `?date=${date}` : ''}`
  const online = new Set(packagedFor?.foods.map((f) => f.id))
  const local = results.filter((r) => !online.has(r.key))

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
          <p className="mt-1 text-sm text-muted">Tap a food to log its usual serving. You can adjust the amount after.</p>
        </form>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => overlay.open('scan')}>
            <BarcodeIcon size={20} />
            Scan
          </Button>
          <Button variant="secondary" onClick={() => overlay.open('quick')}>
            <BoltIcon size={20} />
            Quick log
          </Button>
        </div>

        <LoggedBar
          logged={logged?.item}
          undone={logged?.undone}
          profile={profile}
          onUndo={() => void undo()}
          onAddMacros={(id) => openEntry(id, true)}
          onAdjust={(id) => openEntry(id)}
        />

        {query.trim() ? (
          <>
            <Panel title="Foods" aside={ready ? `${local.length}${local.length >= 40 ? '+' : ''}` : undefined}>
              {error ? (
                <p className="text-muted">Couldn’t load the food list. Check your connection and reload.</p>
              ) : !ready && local.length === 0 ? (
                <ListSkeleton label="Loading foods" />
              ) : local.length ? (
                <FoodResults results={local} unit={unit} onPick={(r) => void pick(r)} />
              ) : (
                <p className="text-muted">Nothing on your device matches. Press Enter or search packaged foods below, or create your own.</p>
              )}
            </Panel>

            <Panel title="Packaged foods" aside="Open Food Facts">
              {!packagedFor ? (
                <Button variant="secondary" className="w-full" onClick={() => void searchPackaged()} disabled={query.trim().length < 2}>
                  Search packaged foods for “{query.trim()}”
                </Button>
              ) : (
                <>
                  {packagedFor.foods.length > 0 && (
                    <FoodResults results={packagedFor.foods.map((f) => foodResult(f))} unit={unit} onPick={(r) => void pick(r)} />
                  )}
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
            {tab === 'recent' && <RecentTab unit={unit} onPick={(r) => void pick(r)} />}
            {tab === 'favorites' && <FavoritesTab unit={unit} onPick={(r) => void pick(r)} />}
            {tab === 'mine' && <MineTab unit={unit} onPick={(r) => void pick(r)} />}
            {tab === 'meals' && <SavedMealsTab unit={unit} onPick={(r) => void pick(r)} />}
          </Tabs>
        )}
      </div>

      {foodId && <FoodLoader id={foodId} meal={meal} units={units} profile={profile} onLog={logPortionFromDialog} onClose={() => overlay.close('food')} />}
      {params.get('quick') === '1' && (
        <QuickAddDialog meal={meal} profile={profile} onSubmit={(p, m) => void logPortionFromDialog(p, m)} onClose={() => overlay.close('quick')} />
      )}
      {params.get('scan') === '1' && <ScannerDialog onFound={(f) => overlay.swap('scan', 'food', f.id)} onClose={() => overlay.close('scan')} />}
      {entryId && profile && (
        <EditEntryDialog
          key={entryId + (params.get('macros') ?? '')}
          id={entryId}
          profile={profile}
          units={units}
          macros={params.get('macros') === '1'}
          onMacros={() => openEntry(entryId, true)}
          onClose={closeEntry}
        />
      )}
    </>
  )
}

/** A scanned (or linked) food: pick the amount first. */
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
    return (
      <Dialog title="Food not found" onClose={onClose}>
        <p>This food isn’t on this device any more. Search for it again.</p>
        <Button onClick={onClose}>Close</Button>
      </Dialog>
    )
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

type TabProps = { unit: 'g' | 'oz'; onPick: (r: FoodResult) => void }

function ListOrEmpty({ results, empty, unit, onPick }: { results: FoodResult[] | undefined; empty: string } & TabProps) {
  if (!results) return <ListSkeleton />
  if (!results.length) return <p className="text-muted">{empty}</p>
  return <FoodResults results={results} unit={unit} onPick={onPick} />
}

function RecentTab(props: TabProps) {
  const recent = useLiveQuery(() => recentFoods(30), [])
  return <ListOrEmpty results={recent?.map((r) => foodResult(r.food, 'recent', r.last))} empty="Foods you log show up here." {...props} />
}

function FavoritesTab(props: TabProps) {
  const favorites = useLiveQuery(listFavorites, [])
  return (
    <ListOrEmpty
      results={favorites?.map((f) => foodResult({ ...f.food, source: sourceFavorite(f.id) }, 'favorite'))}
      empty="No favourites yet. Tap the star on a food to add it here."
      {...props}
    />
  )
}

function MineTab(props: TabProps) {
  const mine = useLiveQuery(listCustomFoods, [])
  return (
    <>
      <ListOrEmpty results={mine?.map((c) => foodResult(customToFood(c), 'custom'))} empty="You haven’t made any foods yet." {...props} />
      <Link
        to="/food/foods/new"
        className="mt-4 inline-flex min-h-touch w-full items-center justify-center border border-panel-edge font-display font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
      >
        Create a food
      </Link>
    </>
  )
}

function SavedMealsTab(props: TabProps) {
  const meals = useLiveQuery(listSavedMeals, [])
  return (
    <>
      <ListOrEmpty
        results={meals?.map((m) => ({ kind: 'meal', key: m.id, meal: m, tier: 'meal', kcal: sumTotals(m.items).kcal }))}
        empty="No saved meals yet. Make one from a name and its calories, or save a meal from the Food tab (⋯ → Save as a meal)."
        {...props}
      />
      <Link to="/food/meals" className="mt-4 inline-flex min-h-touch items-center text-sm text-accent underline underline-offset-2 hover:text-text">
        Manage saved meals
      </Link>
    </>
  )
}
