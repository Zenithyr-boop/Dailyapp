import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { db } from '../../../lib/db'
import { addDays, toDayKey } from '../../../lib/dates'
import { useTodayKey } from '../../quests/useTodayKey'
import { entriesForDay } from '../foodLogRepo'
import { isMealSlot, mealForTime } from '../nutrition'

export function useProfile() {
  return useLiveQuery(() => db.profile.get('me'), [])
}

export function useDayEntries(date: string) {
  return useLiveQuery(() => entriesForDay(date), [date])
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The day being shown (`?date=`, default today) and the meal (`?meal=`, default by time of day). */
export function useFoodParams() {
  const [params, setParams] = useSearchParams()
  const today = useTodayKey()
  const raw = params.get('date')
  const date = raw && DAY_KEY.test(raw) ? raw : today
  const mealRaw = params.get('meal')
  const meal = isMealSlot(mealRaw) ? mealRaw : mealForTime()
  return { params, setParams, date, today, meal }
}

const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** "Today", "Yesterday", "Tomorrow", else "Mon 9 Nov". */
export function dayLabel(date: string, today: string = toDayKey()): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  return shortDate.format(new Date(y!, m! - 1, d!))
}

export function longDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return longDate.format(new Date(y!, m! - 1, d!))
}

/**
 * Dialogs that live in the URL (`?food=…`, `?scan=1`), so the phone's Back
 * button closes them. Opening pushes a history entry; closing goes back when
 * we pushed it, else just drops the parameter.
 */
export function useOverlay() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const pushed = !!(location.state as { overlay?: boolean } | null)?.overlay

  function with_(changes: Record<string, string | undefined>): string {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  return {
    params,
    open(key: string, value = '1') {
      navigate({ search: with_({ [key]: value }) }, { state: { overlay: true }, preventScrollReset: true })
    },
    /** Swap one dialog for another without adding a history entry (scan → found food). */
    swap(from: string, key: string, value = '1') {
      navigate({ search: with_({ [from]: undefined, [key]: value }) }, { replace: true, state: location.state, preventScrollReset: true })
    },
    close(...keys: string[]) {
      if (pushed) navigate(-1)
      else setParams(new URLSearchParams(with_(Object.fromEntries(keys.map((k) => [k, undefined])))), { replace: true, preventScrollReset: true })
    },
  }
}
