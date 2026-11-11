import { db } from '../../lib/db'
import { addDays, dayKeyAt } from '../../lib/day'
import { closeOutDays } from '../quests/closeOut'
import { buildHistory } from '../quests/progress'
import { ensureDay, ensureSetup } from '../quests/questsRepo'
import { FutureDayError, saveBody, saveWeight, setGoalWeight } from './bodyRepo'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
})

describe('saveBody', () => {
  it('logs today’s weigh-in on today’s record without touching its quests', async () => {
    const today = dayKeyAt()
    await ensureDay(today)
    const before = await db.days.get(today)
    await saveWeight(today, 82.45)
    const day = await db.days.get(today)
    expect(day?.weightKg).toBe(82.45)
    expect(day?.quests).toEqual(before?.quests)
    expect(day?.bodyAt?.weightKg).toBeGreaterThan(0)
    expect(day?.dirty).toBe(1)
  })

  it('sets and clears measurements one by one, stamping each change', async () => {
    const today = dayKeyAt()
    await saveBody(today, { waistCm: 84, armCm: 36.123 })
    let day = await db.days.get(today)
    expect(day?.measurements).toEqual({ waistCm: 84, armCm: 36.12 })
    const armAt = day?.bodyAt?.armCm
    await saveBody(today, { waistCm: undefined, armCm: 36.12 }) // arm unchanged
    day = await db.days.get(today)
    expect(day?.measurements).toEqual({ armCm: 36.12 })
    expect(day?.bodyAt?.armCm).toBe(armAt)
    expect(day?.bodyAt?.waistCm).toBeGreaterThan(0)
    await saveBody(today, { armCm: undefined })
    expect((await db.days.get(today))?.measurements).toBeUndefined()
  })

  it('refuses future days', async () => {
    await expect(saveWeight(addDays(dayKeyAt(), 1), 80)).rejects.toBeInstanceOf(FutureDayError)
  })

  it('keeps old weigh-ins out of the quest history and streak', async () => {
    const today = dayKeyAt()
    await closeOutDays(today) // a new user: today is the first quest day
    await saveWeight(addDays(today, -20), 85)
    const old = await db.days.get(addDays(today, -20))
    expect(old?.quests).toEqual([])
    // Closing out again must not back-fill misses from the old weigh-in.
    expect(await closeOutDays(today)).toEqual([])
    const cells = buildHistory(await db.days.toArray(), today, 30)
    expect(cells.find((c) => c.date === addDays(today, -20))?.status).toBe('before-start')
  })

  it('gives a missing day inside the history unchecked quests', async () => {
    const today = dayKeyAt()
    await ensureDay(addDays(today, -3))
    await ensureDay(today)
    await db.days.delete(addDays(today, -1)) // a gap
    await saveWeight(addDays(today, -1), 80)
    const day = await db.days.get(addDays(today, -1))
    expect(day?.quests.length).toBeGreaterThan(0)
    expect(day?.quests.every((q) => !q.done)).toBe(true)
  })

  it('keeps the profile weight on the latest weigh-in', async () => {
    const today = dayKeyAt()
    await saveWeight(today, 80)
    await saveWeight(addDays(today, -5), 83) // older: profile stays on today’s
    expect((await db.profile.get('me'))?.body?.weightKg).toBe(80)
    await saveWeight(today, undefined)
    expect((await db.profile.get('me'))?.body?.weightKg).toBe(83)
  })

  it('stores and clears the goal weight', async () => {
    await setGoalWeight(75)
    expect((await db.profile.get('me'))?.goalWeightKg).toBe(75)
    await setGoalWeight(undefined)
    expect((await db.profile.get('me'))?.goalWeightKg).toBeUndefined()
  })
})
