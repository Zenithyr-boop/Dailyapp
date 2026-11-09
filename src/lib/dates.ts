/** Date helpers. Everything uses the user's local time zone. */

/** Local calendar day as `YYYY-MM-DD` (used as the `days` table key). */
export function toDayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a `YYYY-MM-DD` key into a Date at local midnight. */
export function fromDayKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) throw new Error(`invalid day key: ${key}`)
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Add whole days to a day key (handles month/year/DST boundaries). */
export function addDays(key: string, days: number): string {
  const date = fromDayKey(key)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

/** Milliseconds until the next local midnight, when daily quests reset. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}
