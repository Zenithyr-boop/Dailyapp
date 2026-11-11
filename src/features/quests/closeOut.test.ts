import { createDayClock, getToday } from '../../lib/day'
import { db } from '../../lib/db'
import { mergeDay } from '../../lib/sync/merge'
import { ALL_QUESTS_BONUS, progressFromDays } from '../../lib/xp'
import { closeOutDays, MAX_BACKFILL_DAYS } from './closeOut'
import { buildHistory } from './progress'
import { DayLockedError, ensureDay, ensureSetup, setQuestDone } from './questsRepo'

// Only Date is faked: IndexedDB (fake-indexeddb) needs real timers.
const setNow = (isoLocal: string) => vi.setSystemTime(new Date(isoLocal))

async function finishAll(date: string) {
  const day = await db.days.get(date)
  for (const q of day!.quests) await setQuestDone(date, q.id, true)
}

async function progress(today: string) {
  return progressFromDays(await db.days.toArray(), today)
}

const FULL_DAY = 320 + ALL_QUESTS_BONUS

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setNow('2026-11-05T09:00:00')
  await db.delete()
  await db.open()
  await ensureSetup()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('closeOutDays', () => {
  it('starts only today for a brand-new user', async () => {
    expect(await closeOutDays()).toEqual([])
    expect((await db.days.toArray()).map((d) => d.date)).toEqual(['2026-11-05'])
  })

  it('closes out every skipped day when the app was closed for 3 days', async () => {
    await ensureDay('2026-11-05')
    await finishAll('2026-11-05')

    setNow('2026-11-09T08:00:00') // the 6th, 7th and 8th were never opened
    expect(await closeOutDays()).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])

    const days = await db.days.orderBy('date').toArray()
    expect(days.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'])
    // Missed days are on record: every quest unchecked, no XP.
    for (const d of days.slice(1)) {
      expect(d.quests).toHaveLength(6)
      expect(d.quests.every((q) => !q.done)).toBe(true)
    }
    // The full day keeps its XP and bonus; the misses broke the streak.
    expect(await progress('2026-11-09')).toMatchObject({ totalXp: FULL_DAY, streak: 0 })
    const history = buildHistory(days, '2026-11-09', 5)
    expect(history.map((c) => c.status)).toEqual(['full', 'missed', 'missed', 'missed', 'missed'])
  })

  it('locks in yesterday’s XP and bonus and keeps the streak going', async () => {
    await ensureDay('2026-11-05')
    await finishAll('2026-11-05')
    setNow('2026-11-06T00:00:30')
    expect(await closeOutDays()).toEqual([])
    expect(await progress('2026-11-06')).toMatchObject({ totalXp: FULL_DAY, streak: 1 })
    await finishAll('2026-11-06')
    expect(await progress('2026-11-06')).toMatchObject({ totalXp: 2 * FULL_DAY, streak: 2 })
  })

  it('is safe to run again and again', async () => {
    await ensureDay('2026-11-05')
    setNow('2026-11-08T10:00:00')
    await closeOutDays()
    const before = await db.days.toArray()
    expect(await closeOutDays()).toEqual([])
    expect(await db.days.toArray()).toEqual(before)
  })

  it('never overwrites an existing (deleted) day', async () => {
    await ensureDay('2026-11-05')
    await db.days.put({ date: '2026-11-06', quests: [], updatedAt: 1, deleted: 1 })
    setNow('2026-11-08T10:00:00')
    expect(await closeOutDays()).toEqual(['2026-11-07'])
    expect((await db.days.get('2026-11-06'))?.deleted).toBe(1)
  })

  it(`records at most ${MAX_BACKFILL_DAYS} missed days after a long break`, async () => {
    await ensureDay('2026-11-05')
    setNow('2027-11-05T10:00:00')
    const created = await closeOutDays()
    expect(created).toHaveLength(MAX_BACKFILL_DAYS)
    expect(created.at(-1)).toBe('2027-11-04')
    // Older days without a record still count as missed.
    expect(await progress('2027-11-05')).toMatchObject({ streak: 0 })
  })

  it('uses the 4 AM day start: at 00:30 today is still the previous day', async () => {
    await db.profile.update('me', { dayStartHour: 4 })
    await ensureDay('2026-11-05')
    setNow('2026-11-06T00:30:00')
    expect(await getToday()).toBe('2026-11-05')
    await closeOutDays()
    expect(await db.days.get('2026-11-06')).toBeUndefined()
    // A late tick still counts toward the 5th.
    const quest = (await db.days.get('2026-11-05'))!.quests[0]!
    await setQuestDone('2026-11-05', quest.id, true)
    expect((await db.days.get('2026-11-05'))!.quests[0]!.done).toBe(true)

    setNow('2026-11-06T04:00:00')
    await closeOutDays()
    expect(await db.days.get('2026-11-06')).toBeDefined()
  })

  it('missed-day records never wipe out ticks from another device when synced', async () => {
    await ensureDay('2026-11-05')
    setNow('2026-11-07T09:00:00')
    await closeOutDays()
    const blank = (await db.days.get('2026-11-06'))!
    // The other device did use the app on the 6th.
    const ticked = { ...blank, quests: blank.quests.map((q, i) => (i < 2 ? { ...q, done: true, at: 100 } : q)), updatedAt: 50 }
    for (const concurrent of [true, false]) {
      const merged = mergeDay(blank, ticked, concurrent)
      expect(merged.quests.filter((q) => q.done)).toHaveLength(2)
    }
  })
})

describe('grace period', () => {
  it('allows quest changes today and yesterday, not before', async () => {
    await ensureDay('2026-11-05')
    setNow('2026-11-06T09:00:00')
    await closeOutDays()
    const q = (await db.days.get('2026-11-05'))!.quests[0]!
    await setQuestDone('2026-11-05', q.id, true) // yesterday: fine

    setNow('2026-11-07T09:00:00')
    await closeOutDays()
    await expect(setQuestDone('2026-11-05', q.id, false)).rejects.toBeInstanceOf(DayLockedError)
    expect((await db.days.get('2026-11-05'))!.quests[0]!.done).toBe(true)
  })

  it('rejects future days', async () => {
    await ensureDay('2026-11-06') // e.g. a record from a device whose clock ran ahead
    const q = (await db.days.get('2026-11-06'))!.quests[0]!
    await expect(setQuestDone('2026-11-06', q.id, true)).rejects.toBeInstanceOf(DayLockedError)
  })
})

describe('rollover with the app clock', () => {
  it('closes out the days missed while a phone slept for 3 days', async () => {
    await ensureDay('2026-11-05')
    await finishAll('2026-11-05')
    const changes: Promise<string[]>[] = []
    const clock = createDayClock({ onNewDay: () => changes.push(closeOutDays()) })
    clock.start({ watchProfile: false })
    try {
      // Screen off at 22:00 on the 5th; back on at 07:30 on the 8th.
      setNow('2026-11-08T07:30:00')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(clock.getSnapshot().today).toBe('2026-11-08')
      expect(changes).toHaveLength(1)
      expect(await changes[0]).toEqual(['2026-11-06', '2026-11-07'])
      expect(await db.days.get('2026-11-08')).toBeDefined()
      expect(await progress('2026-11-08')).toMatchObject({ totalXp: FULL_DAY, streak: 0 })
    } finally {
      clock.stop()
    }
  })

  it('a phone asleep across midnight starts the new day on wake, keeping yesterday open', async () => {
    await ensureDay('2026-11-05')
    const clock = createDayClock({ onNewDay: () => void closeOutDays() })
    setNow('2026-11-05T23:40:00')
    clock.start({ watchProfile: false })
    try {
      setNow('2026-11-06T06:45:00')
      window.dispatchEvent(new Event('focus'))
      expect(clock.getSnapshot().today).toBe('2026-11-06')
      await vi.waitFor(async () => expect(await db.days.get('2026-11-06')).toBeDefined())
      // Forgot to tick last night: yesterday is still open.
      const q = (await db.days.get('2026-11-05'))!.quests[1]!
      await setQuestDone('2026-11-05', q.id, true)
      expect((await db.days.get('2026-11-05'))!.quests[1]!.done).toBe(true)
    } finally {
      clock.stop()
    }
  })
})
