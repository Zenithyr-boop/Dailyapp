import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { DateSwitcher } from '../../components/DateSwitcher'
import { Dialog } from '../../components/Dialog'
import { ChevronRightIcon, CopyIcon, MoreIcon, PlusIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import { addDays } from '../../lib/day'
import type { FoodEntry, MealSlot, Portion, Profile } from '../../lib/db'
import { inputClass } from '../train/workouts/fields'
import { useUnits } from '../profile/units'
import { copyDay, copyMeal, deleteEntry, entriesForDay, getEntry, updateEntry } from './foodLogRepo'
import { createSavedMeal, FOOD_NAME_MAX, getFood, setMealName } from './foodsRepo'
import {
  describeAmount,
  foodFromPortion,
  formatKcal,
  MEAL_NAME_MAX,
  MEAL_SLOTS,
  mealName,
  sumTotals,
  type Food,
} from './nutrition'
import { longDayLabel, useDayEntries, useFoodParams, useProfile } from './ui/hooks'
import { PortionDialog } from './ui/PortionDialog'
import { DayTotals, MacroLine } from './ui/TotalsBars'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The Food tab: a day's totals against the targets, and its four meals. */
export function FoodPage() {
  const { params, setParams, date, today } = useFoodParams()
  const profile = useProfile()
  const units = useUnits()
  const entries = useDayEntries(date)
  const yesterdayCount = useLiveQuery(async () => (await entriesForDay(addDays(date, -1))).length, [date]) ?? 0
  // A message for the day it was about (moving to another day hides it).
  const [message, setMessage] = useState<{ date: string; text: string }>()
  const status = message?.date === date ? message.text : ''
  const setStatus = (text: string) => setMessage({ date, text })
  const [menu, setMenu] = useState<MealSlot>()
  const entryId = params.get('entry')

  function openEntry(id?: string) {
    const p = new URLSearchParams(params)
    if (id) p.set('entry', id)
    else p.delete('entry')
    setParams(p, { replace: !id })
  }

  async function copyYesterday() {
    const n = await copyDay(addDays(date, -1), date)
    setStatus(`Copied ${plural(n, 'food')} from the day before.`)
  }

  const addLink = (meal: MealSlot) => `/food/add?${new URLSearchParams({ ...(date !== today ? { date } : {}), meal })}`

  return (
    <>
      <header className="mb-5">
        <p className="label mb-1">{longDayLabel(date)}</p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-4xl font-extrabold leading-none">Food</h1>
          <DateSwitcher date={date} today={today} clear={['entry']} />
        </div>
      </header>

      {!entries || !profile ? (
        <p className="text-muted" role="status">
          Loading food…
        </p>
      ) : (
        <div className="space-y-4">
          <DayTotals totals={sumTotals(entries)} goals={profile.goals} />

          <Button variant="secondary" onClick={() => void copyYesterday()} disabled={yesterdayCount === 0} className="w-full sm:w-auto">
            <CopyIcon size={18} />
            Copy {date === today ? 'yesterday' : 'the day before'}
            {yesterdayCount ? ` (${plural(yesterdayCount, 'food')})` : ''}
          </Button>
          <p role="status" className={status ? 'text-sm' : 'sr-only'}>
            {status}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {MEAL_SLOTS.map((slot) => (
              <MealPanel
                key={slot}
                slot={slot}
                profile={profile}
                entries={entries.filter((e) => e.meal === slot)}
                addLink={addLink(slot)}
                units={units === 'imperial' ? 'oz' : 'g'}
                onOpen={(id) => openEntry(id)}
                onMenu={() => setMenu(slot)}
              />
            ))}
          </div>

          <Panel title="Your food">
            <ul className="-mx-4 -my-4">
              <li className="border-b border-line-soft">
                <NavRow to="/food/meals" title="Saved meals" sub="Foods you eat together, logged in one tap" />
              </li>
              <li>
                <NavRow to="/food/foods" title="My foods" sub="Foods you made, and your fixes to packaged foods" />
              </li>
            </ul>
          </Panel>
        </div>
      )}

      {menu && profile && (
        <MealMenu
          slot={menu}
          date={date}
          profile={profile}
          entries={entries?.filter((e) => e.meal === menu) ?? []}
          onDone={(message) => {
            setMenu(undefined)
            if (message) setStatus(message)
          }}
        />
      )}
      {entryId && profile && <EditEntry id={entryId} profile={profile} units={units} onClose={() => openEntry()} />}
    </>
  )
}

function NavRow({ to, title, sub }: { to: string; title: string; sub: string }) {
  return (
    <Link to={to} className="group flex min-h-touch items-center gap-3 px-4 py-2.5">
      <span className="flex-1">
        <span className="block font-display text-lg font-semibold uppercase tracking-wider group-hover:text-accent">{title}</span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
      <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
    </Link>
  )
}

function MealPanel({
  slot,
  profile,
  entries,
  addLink,
  units,
  onOpen,
  onMenu,
}: {
  slot: MealSlot
  profile: Profile
  entries: FoodEntry[]
  addLink: string
  units: 'g' | 'oz'
  onOpen: (id: string) => void
  onMenu: () => void
}) {
  const name = mealName(slot, profile)
  const totals = sumTotals(entries)
  return (
    <Panel
      title={name}
      aside={
        <span className="flex items-center gap-1">
          <span className="tabular-nums">{formatKcal(totals.kcal)} kcal</span>
          <button
            type="button"
            aria-label={`${name}: more actions`}
            title="More actions"
            onClick={onMenu}
            className="-mr-3 grid size-touch place-items-center text-muted hover:text-accent"
          >
            <MoreIcon size={20} />
          </button>
        </span>
      }
    >
      {entries.length ? (
        <>
          <ul className="-mx-4 -mt-4">
            {entries.map((e) => (
              <li key={e.id} className="border-b border-line-soft">
                <button type="button" onClick={() => onOpen(e.id)} className="group flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-accent">{e.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {[e.brand, describeAmount(e, units)].filter(Boolean).join(' · ')}
                      {e.missing?.length ? ' · incomplete' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg font-semibold tabular-nums">{formatKcal(e.kcal)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            <MacroLine totals={totals} />
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Nothing logged.</p>
      )}
      <Link
        to={addLink}
        className="mt-3 inline-flex min-h-touch w-full items-center justify-center gap-2 border border-panel-edge font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
      >
        <PlusIcon size={18} />
        Add food<span className="sr-only"> to {name}</span>
      </Link>
    </Panel>
  )
}

type MenuView = 'list' | 'save' | 'rename'

/** A meal's actions: copy yesterday's, save as a meal, rename. */
function MealMenu({
  slot,
  date,
  profile,
  entries,
  onDone,
}: {
  slot: MealSlot
  date: string
  profile: Profile
  entries: FoodEntry[]
  onDone: (message?: string) => void
}) {
  const id = useId()
  const name = mealName(slot, profile)
  const [view, setView] = useState<MenuView>('list')
  const [text, setText] = useState('')
  const yesterday = useLiveQuery(async () => (await entriesForDay(addDays(date, -1))).filter((e) => e.meal === slot).length, [date, slot])

  async function copy() {
    const n = await copyMeal(addDays(date, -1), slot, date)
    onDone(`Copied ${plural(n, 'food')} into ${name}.`)
  }

  async function save() {
    await createSavedMeal(text, entries)
    onDone(`Saved “${text.trim() || 'My meal'}”. Find it under Saved meals when you add food.`)
  }

  async function rename() {
    await setMealName(slot, text)
    onDone()
  }

  if (view === 'save' || view === 'rename') {
    const saving = view === 'save'
    return (
      <Dialog title={saving ? `Save ${name} as a meal` : `Rename ${name}`} onClose={() => onDone()}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void (saving ? save() : rename())
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor={`${id}-name`} className="label">
              {saving ? 'Meal name' : 'Name'}
            </label>
            <input
              id={`${id}-name`}
              className={`${inputClass} mt-1`}
              value={text}
              maxLength={saving ? FOOD_NAME_MAX : MEAL_NAME_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder={saving ? 'e.g. Usual breakfast' : undefined}
            />
            {saving ? (
              <p className="mt-1 text-sm text-muted">{plural(entries.length, 'food')}, {formatKcal(sumTotals(entries).kcal)} kcal.</p>
            ) : (
              <p className="mt-1 text-sm text-muted">Leave empty to use the default name.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Save
            </Button>
            <Button variant="secondary" onClick={() => onDone()}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    )
  }

  const action = 'flex min-h-touch w-full items-center px-4 text-left font-semibold hover:text-accent disabled:text-faint disabled:hover:text-faint'
  return (
    <Dialog title={name} onClose={() => onDone()}>
      <ul className="-mx-5 -my-5">
        <li className="border-b border-line-soft">
          <button type="button" className={action} disabled={!yesterday} onClick={() => void copy()}>
            Copy {name} from the day before{yesterday ? ` (${plural(yesterday, 'food')})` : ' (empty)'}
          </button>
        </li>
        <li className="border-b border-line-soft">
          <button
            type="button"
            className={action}
            disabled={!entries.length}
            onClick={() => {
              setText(`${name} ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date())}`)
              setView('save')
            }}
          >
            Save as a meal
          </button>
        </li>
        <li className="border-b border-line-soft">
          <button
            type="button"
            className={action}
            onClick={() => {
              setText(profile.mealNames?.[slot] ?? '')
              setView('rename')
            }}
          >
            Rename this meal
          </button>
        </li>
        <li>
          <button type="button" className={`${action} text-muted`} onClick={() => onDone()}>
            Close
          </button>
        </li>
      </ul>
    </Dialog>
  )
}

/** Edit or remove a logged entry. */
function EditEntry({ id, profile, units, onClose }: { id: string; profile: Profile; units: 'metric' | 'imperial'; onClose: () => void }) {
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

  if (!food) return <QuickEntry entry={entry} profile={profile} onSave={save} onRemove={remove} onClose={onClose} />
  return (
    <PortionDialog
      food={food}
      initial={entry}
      meal={entry.meal}
      profile={profile}
      units={units}
      submitLabel="Save"
      onSubmit={(p, meal) => void save(p, meal)}
      onDelete={() => void remove()}
      onClose={onClose}
    />
  )
}

function QuickEntry({
  entry,
  profile,
  onSave,
  onRemove,
  onClose,
}: {
  entry: FoodEntry
  profile: Profile
  onSave: (p: Portion, meal: MealSlot) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}) {
  const id = useId()
  const [meal, setMeal] = useState(entry.meal)
  return (
    <Dialog title={entry.name} onClose={onClose}>
      <p>
        {formatKcal(entry.kcal)} kcal · <MacroLine totals={entry} />
      </p>
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
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void onSave(entry, meal)}>
          Save
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <Button variant="secondary" className="w-full" onClick={() => void onRemove()}>
        Remove from log
      </Button>
    </Dialog>
  )
}
