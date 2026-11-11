import { db } from '../../lib/db'
import { addDays, dayKeyAt } from '../../lib/day'
import { saveWeight } from '../body/bodyRepo'
import { deleteEntry, logPortion } from '../food/foodLogRepo'
import { addWater, saveStats } from '../today/statsRepo'
import { refreshAutoQuests } from './autoQuests'
import { addQuest, ensureDay, ensureSetup, setQuestDone } from './questsRepo'

const quest = async (date: string, title: string) => (await db.days.get(date))!.quests.find((q) => q.title === title)!

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureSetup()
  await db.profile.update('me', { goals: { proteinG: 100, kcal: 2000 } })
})

describe('automatic quests', () => {
  it('tick and untick with the day’s food, steps and weigh-in', async () => {
    const today = dayKeyAt()
    await ensureDay(today)
    const id = await logPortion(today, 'lunch', { name: 'Chicken', kcal: 600, proteinG: 120, carbsG: 0, fatG: 10 })
    await refreshAutoQuests(today)
    expect((await quest(today, 'Hit protein goal')).done).toBe(true)

    await deleteEntry(id)
    await refreshAutoQuests(today)
    expect((await quest(today, 'Hit protein goal')).done).toBe(false)

    await saveStats(today, { steps: 8500 })
    await refreshAutoQuests(today)
    expect((await quest(today, 'Walk 8,000 steps')).done).toBe(true)
    expect((await quest(today, 'Walk 8,000 steps')).at).toBeGreaterThan(0)
  })

  it('cover quests added later, water and weigh-ins', async () => {
    const today = dayKeyAt()
    await addQuest({ title: 'Drink 2 L', xp: 30, kind: 'check', link: { source: 'water', target: 2000 } })
    await addQuest({ title: 'Weigh in', xp: 20, kind: 'check', link: { source: 'weighIn' } })
    await addWater(today, 1500)
    await addWater(today, 500)
    await saveWeight(today, 80)
    expect(await refreshAutoQuests(today)).toEqual([today])
    expect((await quest(today, 'Drink 2 L')).done).toBe(true)
    expect((await quest(today, 'Weigh in')).done).toBe(true)
    expect(await refreshAutoQuests(today)).toEqual([]) // nothing left to change
  })

  it('reach yesterday but not older days', async () => {
    const today = dayKeyAt()
    for (const d of [addDays(today, -2), addDays(today, -1), today]) await ensureDay(d)
    await saveStats(addDays(today, -1), { steps: 9000 })
    await saveStats(addDays(today, -2), { steps: 9000 })
    await refreshAutoQuests(today)
    expect((await quest(addDays(today, -1), 'Walk 8,000 steps')).done).toBe(true)
    expect((await quest(addDays(today, -2), 'Walk 8,000 steps')).done).toBe(false)
  })

  it('can’t be ticked by hand', async () => {
    const today = dayKeyAt()
    await ensureDay(today)
    const steps = await quest(today, 'Walk 8,000 steps')
    await setQuestDone(today, steps.id, true)
    expect((await quest(today, 'Walk 8,000 steps')).done).toBe(false)
  })
})
