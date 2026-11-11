import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router'
import { db } from '../../../lib/db'
import { clampDay, useToday } from '../../../lib/day'
import { entriesForDay } from '../foodLogRepo'
import { isMealSlot, mealForTime } from '../nutrition'

export function useProfile() {
  return useLiveQuery(() => db.profile.get('me'), [])
}

export function useDayEntries(date: string) {
  return useLiveQuery(() => entriesForDay(date), [date])
}

/** The day being shown (`?date=`, default today, never in the future) and the meal (`?meal=`, default by time of day). */
export function useFoodParams() {
  const [params, setParams] = useSearchParams()
  const today = useToday()
  const date = clampDay(params.get('date'), today)
  const mealRaw = params.get('meal')
  const meal = isMealSlot(mealRaw) ? mealRaw : mealForTime()
  return { params, setParams, date, today, meal }
}

/** Day labels live with the rest of the day logic. */
export { dayLabel, longDayLabel } from '../../../lib/day'

/** URL dialogs are shared with other screens. */
export { useOverlay } from '../../../components/useOverlay'
