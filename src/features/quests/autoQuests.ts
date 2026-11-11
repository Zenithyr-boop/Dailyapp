/**
 * The engine behind automatic quests. Whenever anything they look at changes
 * (food, workouts, the day's stats or weigh-in, goals, quest edits, data synced
 * from another device), each automatic quest of today and yesterday (the grace
 * window, see `canEditQuests`) is re-evaluated and its `done` written when it
 * differs. Only `done` is stored, so XP, the bonus and streaks stay derived
 * from the days as before; live numbers are worked out on screen.
 */
import { liveQuery, type Subscription } from 'dexie'
import { db, type Profile } from '../../lib/db'
import { addDays, dayClock, getToday } from '../../lib/day'
import { sumTotals } from '../food/nutrition'
import { evaluateLink, type LinkData } from './links'
import { checkMilestones } from './questsRepo'

/** Everything a day's automatic quests look at. */
export async function linkDataFor(date: string, goals: Profile['goals'] = {}): Promise<LinkData> {
  const [day, food, sessions, photos] = await Promise.all([
    db.days.get(date),
    db.food.where('date').equals(date).toArray(),
    db.sessions.where('date').equals(date).toArray(),
    db.photos.where('date').equals(date).count(),
  ])
  const entries = food.filter((e) => !e.deleted)
  const totals = sumTotals(entries)
  return {
    steps: day?.steps,
    sleepMinutes: day?.sleepMinutes,
    waterMl: day?.waterMl,
    weightKg: day?.weightKg,
    kcal: totals.kcal,
    proteinG: totals.proteinG,
    foodEntries: entries.length,
    workouts: sessions.filter((s) => !s.deleted && s.finishedAt !== undefined).length,
    photos,
    goals: { kcal: goals.kcal, proteinG: goals.proteinG },
  }
}

/**
 * Re-evaluate the automatic quests of today and yesterday. Returns the days
 * whose quests changed.
 */
export async function refreshAutoQuests(today?: string): Promise<string[]> {
  const key = today ?? (await getToday())
  const changed: string[] = []
  for (const date of [addDays(key, -1), key]) {
    const did = await db.transaction('rw', [db.days, db.profile, db.food, db.sessions, db.photos], async () => {
      const day = await db.days.get(date)
      if (!day || day.deleted || !day.quests.some((q) => q.link)) return false
      const data = await linkDataFor(date, (await db.profile.get('me'))?.goals)
      const now = Date.now()
      let any = false
      const quests = day.quests.map((q) => {
        if (!q.link) return q
        const { done } = evaluateLink(q.link, data)
        if (done === q.done) return q
        // Photos stay on the device they were taken on: another device (no photo) must not untick it.
        if (q.link.source === 'photo' && q.done) return q
        any = true
        return { ...q, done, at: now }
      })
      if (!any) return false
      await db.days.put({ ...day, quests, updatedAt: now })
      return true
    })
    if (did) changed.push(date)
  }
  if (changed.length) await checkMilestones(key)
  return changed
}

/**
 * Keep automatic quests up to date while the app is open: watch what they look
 * at for today and yesterday, and follow the day clock to the next day.
 */
export function startAutoQuests(): () => void {
  let sub: Subscription | undefined
  let queue: Promise<unknown> = Promise.resolve()

  const watch = (today: string) => {
    sub?.unsubscribe()
    const dates = [addDays(today, -1), today]
    // The value is only a trigger; refreshAutoQuests re-reads everything in one transaction.
    sub = liveQuery(async () => {
      const goals = (await db.profile.get('me'))?.goals
      const parts = await Promise.all(
        dates.map(async (d) => ({
          data: await linkDataFor(d, goals),
          quests: (await db.days.get(d))?.quests.filter((q) => q.link).map((q) => [q.id, q.done, q.link]),
        })),
      )
      return JSON.stringify(parts)
    }).subscribe({
      next: () => {
        queue = queue.then(() => refreshAutoQuests(today)).catch(() => {})
      },
      error: () => {},
    })
  }

  watch(dayClock.getSnapshot().today)
  const stopDay = dayClock.onNewDay((today) => watch(today))
  return () => {
    stopDay()
    sub?.unsubscribe()
  }
}
