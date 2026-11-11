/** Training volume by week (weeks start Monday, like the calendars). Pure; tested in `week.test.ts`. */
import { addDays, daysBetween, fromDayKey } from '../../lib/day'

/** The Monday of the week holding `date`. */
export function weekStart(date: string): string {
  const dow = (fromDayKey(date).getDay() + 6) % 7 // Monday = 0
  return addDays(date, -dow)
}

/** Volume (kg) for each day Monday–Sunday of the week starting `monday`. */
export function volumeByDay(sessions: readonly { date: string; volumeKg: number }[], monday: string): number[] {
  const out = Array<number>(7).fill(0)
  for (const s of sessions) {
    const i = daysBetween(monday, s.date)
    if (i >= 0 && i < 7) out[i]! += s.volumeKg
  }
  return out
}
