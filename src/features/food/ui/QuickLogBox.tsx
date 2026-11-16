import { useDeferredValue, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { BarcodeIcon, BoltIcon } from '../../../components/icons'
import type { MealSlot, Profile } from '../../../lib/db'
import { foodForBarcode } from '../foodsRepo'
import { logMeal, logOne, logQuickText, type Logged } from '../logActions'
import { formatG, formatKcal, MEAL_SLOTS, mealName, type Food } from '../nutrition'
import { cleanBarcode, offErrorText, searchProducts } from '../off'
import { parseQuickLog, QUICK_LOG_DEFAULT_NAME } from '../quickLog'
import { FoodResults } from './FoodResults'
import { foodResult, useFoodSearch, type FoodResult } from './useFoodSearch'

type Packaged = { q: string; foods: Food[]; loading: boolean; error?: string }

/**
 * The Food tab's one box. Type "chicken and rice 500" and press Enter to log it
 * (only calories are needed; "40p 50c 12f" adds macros). Typing a food name
 * searches: your recents and foods first, then whole foods and dishes; tap one
 * to log its usual serving. Packaged foods (Open Food Facts) only on request,
 * for a barcode, or when nothing on the device matches.
 */
export function QuickLogBox({
  date,
  today,
  profile,
  meal,
  onMeal,
  unit,
  onLogged,
}: {
  date: string
  today: string
  profile?: Pick<Profile, 'mealNames'>
  meal: MealSlot
  onMeal: (m: MealSlot) => void
  unit: 'g' | 'oz'
  onLogged: (l: Logged) => void
}) {
  const id = useId()
  const [text, setText] = useState('')
  const [save, setSave] = useState(false)
  const [hint, setHint] = useState('')
  const [packaged, setPackaged] = useState<Packaged>()
  const query = text.trim()
  const deferred = useDeferredValue(query)
  const parsed = parseQuickLog(text)
  // Search with the numbers taken out ("chicken and rice 500" searches "chicken and rice").
  const searchText = parsed ? parsed.name : deferred
  const { results, ready, error } = useFoodSearch(searchText.length >= 2 ? searchText : '', 8)
  const barcode = /^\d{8,14}$/.test(query) ? cleanBarcode(query) : undefined
  const packagedFor = packaged?.q === query ? packaged : undefined

  function reset() {
    setText('')
    setSave(false)
    setHint('')
    setPackaged(undefined)
  }

  async function logParsed() {
    if (!parsed) return
    onLogged(await logQuickText(date, meal, parsed, save && !!parsed.name))
    reset()
  }

  async function pick(r: FoodResult) {
    const logged = r.kind === 'meal' ? await logMeal(date, meal, r.meal.id) : await logOne(date, meal, r.portion)
    if (logged) onLogged(logged)
    reset()
  }

  async function searchPackaged() {
    const q = query
    if (q.length < 2) return
    setPackaged({ q, foods: [], loading: true })
    try {
      if (barcode) {
        const food = await foodForBarcode(barcode)
        setPackaged({ q, foods: food ? [food] : [], loading: false })
      } else {
        const result = await searchProducts(q, 1)
        setPackaged({ q, foods: result.foods.slice(0, 8), loading: false })
      }
    } catch (e) {
      setPackaged({ q, foods: [], loading: false, error: offErrorText(e) })
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (parsed) return void logParsed()
    if (!query) return
    // Nothing on the device matches (or it's a barcode): ask Open Food Facts.
    if (barcode || (ready && results.length === 0)) return void searchPackaged()
    setHint(`Pick a food below, or add the calories to log “${query}” as it is (e.g. “${query} 300”).`)
  }

  const mealLabel = mealName(meal, profile)
  const addLink = `/food/add?${new URLSearchParams({ ...(date !== today ? { date } : {}), meal })}`
  const showResults = query.length >= 2 && !barcode

  return (
    <section aria-label="Quick log" className="border border-panel-edge bg-panel p-4">
      <form onSubmit={submit}>
        <label htmlFor={id} className="label">
          Log food
        </label>
        <div className="mt-1 flex gap-2">
          <div className="flex min-w-0 flex-1 border border-line bg-bg focus-within:border-accent">
            <BoltIcon size={20} className="ml-3 shrink-0 self-center text-muted" />
            <input
              id={id}
              type="text"
              enterKeyHint={parsed ? 'done' : 'search'}
              autoComplete="off"
              placeholder="e.g. chicken and rice 500"
              aria-describedby={`${id}-help`}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setHint('')
              }}
              className="min-h-touch min-w-0 flex-1 bg-transparent px-3 text-text placeholder:text-faint focus:outline-none"
            />
          </div>
          <Link
            to={`${addLink}&scan=1`}
            aria-label="Scan a barcode"
            title="Scan a barcode"
            className="grid size-touch shrink-0 place-items-center border border-panel-edge text-muted hover:border-accent hover:text-accent"
          >
            <BarcodeIcon size={20} />
          </Link>
        </div>
        <p id={`${id}-help`} className={query ? 'sr-only' : 'mt-1 text-sm text-muted'}>
          Type what you ate and the calories, or search for a food.
        </p>

        {query && (
          <div className="mt-3">
            <p className="label" id={`${id}-meal`}>
              Log to
            </p>
            <div role="group" aria-labelledby={`${id}-meal`} className="mt-1 grid grid-cols-4 gap-1">
              {MEAL_SLOTS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === meal}
                  onClick={() => onMeal(m)}
                  className={`min-h-touch truncate border px-1 font-display text-sm font-bold uppercase tracking-wider ${
                    m === meal ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-accent hover:text-text'
                  }`}
                >
                  {mealName(m, profile)}
                </button>
              ))}
            </div>
          </div>
        )}

        {parsed && (
          <div className="mt-3 border-t border-line-soft pt-3">
            <Button type="submit" className="w-full justify-between normal-case tracking-normal">
              <span className="truncate font-body font-semibold">
                Log “{parsed.name || QUICK_LOG_DEFAULT_NAME}” to {mealLabel}
              </span>
              <span className="shrink-0 font-display tabular-nums">{formatKcal(parsed.kcal)} kcal</span>
            </Button>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {parsed.proteinG !== undefined || parsed.carbsG !== undefined || parsed.fatG !== undefined
                ? ['P', 'C', 'F']
                    .map((l, i) => {
                      const v = [parsed.proteinG, parsed.carbsG, parsed.fatG][i]
                      return `${l} ${v === undefined ? '?' : formatG(v)}`
                    })
                    .join(' · ') + ' g'
                : 'No macros needed. Add them later if you like, or type “40p 50c 12f”.'}
            </p>
            <label className={`mt-1 flex min-h-touch items-center gap-3 ${parsed.name ? '' : 'text-faint'}`}>
              <input
                type="checkbox"
                className="size-5 accent-accent"
                checked={save && !!parsed.name}
                disabled={!parsed.name}
                onChange={(e) => setSave(e.target.checked)}
              />
              <span>Save for next time{parsed.name ? '' : ' (needs a name)'}</span>
            </label>
          </div>
        )}
        <p role="status" className={hint ? 'mt-2 text-sm text-muted' : 'sr-only'}>
          {hint}
        </p>
      </form>

      {showResults && (
        <div className="mt-3 border-t border-line-soft pt-4">
          <h2 className="label mb-3">{parsed ? 'Or pick a food' : 'Foods'}</h2>
          {error ? (
            <p className="text-sm text-muted">Couldn’t load the food list. Check your connection and reload.</p>
          ) : !ready && results.length === 0 ? (
            <p className="text-sm text-muted">Loading foods…</p>
          ) : results.length ? (
            <div className="px-4">
              <FoodResults results={results} unit={unit} onPick={(r) => void pick(r)} label="Matching foods" />
            </div>
          ) : (
            <p className="text-sm text-muted">Nothing on your device matches “{searchText}”.</p>
          )}
        </div>
      )}

      {query.length >= 2 && !parsed && (
        <div className="mt-3">
          {!packagedFor ? (
            <Button variant="secondary" className="w-full" onClick={() => void searchPackaged()}>
              {barcode ? `Look up barcode ${barcode}` : 'Search packaged foods'}
            </Button>
          ) : packagedFor.loading ? (
            <p role="status" className="text-sm text-muted">
              Searching Open Food Facts…
            </p>
          ) : packagedFor.error ? (
            <p role="alert" className="text-sm">
              {packagedFor.error}
            </p>
          ) : packagedFor.foods.length ? (
            <div className="border-t border-line-soft px-4 pt-4">
              <h2 className="label -mx-4 mb-3">Packaged foods · Open Food Facts</h2>
              <FoodResults results={packagedFor.foods.map((f) => foodResult(f))} unit={unit} onPick={(r) => void pick(r)} label="Packaged foods" />
            </div>
          ) : (
            <p className="text-sm text-muted">No packaged foods found. Try fewer words, scan the barcode, or add the calories to log it as it is.</p>
          )}
        </div>
      )}
    </section>
  )
}
