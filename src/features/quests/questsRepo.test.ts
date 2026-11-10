import { db } from '../../lib/db'
import { progressFromDays, totalXpForLevel } from '../../lib/xp'
import {
  addQuest,
  deleteQuest,
  dismissCelebration,
  ensureDay,
  ensureSetup,
  listQuestDefs,
  moveQuest,
  checkMilestones,
  getCelebration,
  setQuestDone,
  stepCount,
  updateQuest,
} from './questsRepo'

function setToday(isoLocal: string) {
  vi.setSystemTime(new Date(isoLocal))
}

async function progress(today = '2026-11-09') {
  return progressFromDays(await db.days.toArray(), today)
}

async function finishAll(date: string) {
  const day = await db.days.get(date)
  for (const q of day!.quests) await setQuestDone(date, q.id, true)
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setToday('2026-11-09T09:00:00')
  await db.delete()
  await db.open()
  await ensureSetup()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('setup', () => {
  it('creates the six default quests once', async () => {
    await ensureSetup()
    const defs = await listQuestDefs()
    expect(defs.map((d) => [d.title, d.xp])).toEqual([
      ['Train', 120],
      ['Hit protein goal', 60],
      ['Walk 8,000 steps', 40],
      ['In bed by 23:00', 40],
      ['Read 10 pages', 30],
      ['No added sugar', 30],
    ])
  })

  it('does not bring defaults back after the user deletes them all', async () => {
    for (const d of await listQuestDefs()) await deleteQuest(d.id)
    await ensureSetup()
    expect(await listQuestDefs()).toHaveLength(0)
  })
})

describe('days', () => {
  it('starts each new day with every quest unchecked', async () => {
    await ensureDay('2026-11-09')
    await finishAll('2026-11-09')
    setToday('2026-11-10T00:00:01')
    await ensureDay('2026-11-10')
    const next = await db.days.get('2026-11-10')
    expect(next?.quests).toHaveLength(6)
    expect(next?.quests.every((q) => !q.done)).toBe(true)
  })

  it('gives quest XP plus the +80 bonus for a full day, and a streak', async () => {
    await ensureDay('2026-11-09')
    await finishAll('2026-11-09')
    expect(await progress()).toMatchObject({ totalXp: 320 + 80, streak: 1 })
  })

  it('takes XP back when a quest is unchecked', async () => {
    await ensureDay('2026-11-09')
    await finishAll('2026-11-09')
    const first = (await db.days.get('2026-11-09'))!.quests[0]!
    await setQuestDone('2026-11-09', first.id, false)
    expect((await progress()).totalXp).toBe(320 - 120)
  })

  it('resets the streak after a missed day', async () => {
    await ensureDay('2026-11-09')
    await finishAll('2026-11-09')
    setToday('2026-11-11T08:00:00') // the 10th was skipped
    await ensureDay('2026-11-11')
    expect((await progress('2026-11-11')).streak).toBe(0)
  })
})

describe('count quests', () => {
  it('fills up with + and completes at the target', async () => {
    await ensureDay('2026-11-09')
    const id = await addQuest({ title: 'Drink water', xp: 20, kind: 'count', target: 3, unit: 'L', step: 0.5 })
    for (let i = 0; i < 5; i++) await stepCount('2026-11-09', id, 1)
    let q = (await db.days.get('2026-11-09'))!.quests.find((x) => x.id === id)!
    expect(q).toMatchObject({ value: 2.5, done: false })
    await stepCount('2026-11-09', id, 1)
    q = (await db.days.get('2026-11-09'))!.quests.find((x) => x.id === id)!
    expect(q).toMatchObject({ value: 3, done: true })
  })
})

describe('editing quests', () => {
  it('adds new quests to today, unchecked, and clamps XP', async () => {
    await ensureDay('2026-11-09')
    const id = await addQuest({ title: '  Stretch  ', xp: 5000, kind: 'check' })
    const today = await db.days.get('2026-11-09')
    expect(today?.quests.at(-1)).toMatchObject({ id, title: 'Stretch', xp: 150, done: false })
  })

  it('keeps past days frozen', async () => {
    await ensureDay('2026-11-09')
    setToday('2026-11-10T08:00:00')
    await ensureDay('2026-11-10')
    const [first] = await listQuestDefs()
    await updateQuest(first!.id, { title: 'Train hard', xp: 90, kind: 'check' })
    expect((await db.days.get('2026-11-09'))!.quests[0]!.title).toBe('Train')
    expect((await db.days.get('2026-11-10'))!.quests[0]!.title).toBe('Train hard')
  })

  it('reorders quests and today follows', async () => {
    await ensureDay('2026-11-09')
    const [first] = await listQuestDefs()
    await moveQuest(first!.id, 1)
    expect((await listQuestDefs()).map((d) => d.title).slice(0, 2)).toEqual(['Hit protein goal', 'Train'])
    expect((await db.days.get('2026-11-09'))!.quests[1]!.title).toBe('Train')
    // Moving past the top is a no-op.
    const [top] = await listQuestDefs()
    await moveQuest(top!.id, -1)
    expect((await listQuestDefs())[0]!.id).toBe(top!.id)
  })

  it('removes deleted quests from today and keeps a tombstone for sync', async () => {
    await ensureDay('2026-11-09')
    const [first] = await listQuestDefs()
    await deleteQuest(first!.id)
    expect((await db.days.get('2026-11-09'))!.quests).toHaveLength(5)
    expect(await listQuestDefs()).toHaveLength(5)
    expect(await db.quests.get(first!.id)).toMatchObject({ deleted: 1, dirty: 1 })
  })
})

describe('sync flags', () => {
  it('flags every local change for upload and stamps updatedAt', async () => {
    await ensureDay('2026-11-09')
    const before = (await db.days.get('2026-11-09'))!
    expect(before.dirty).toBe(1)
    await db.days.update('2026-11-09', { dirty: 0 }) // pretend it was uploaded… but a local write re-flags it
    expect((await db.days.get('2026-11-09'))!.dirty).toBe(1)
    setToday('2026-11-09T10:00:00')
    await setQuestDone('2026-11-09', before.quests[0]!.id, true)
    const after = (await db.days.get('2026-11-09'))!
    expect(after).toMatchObject({ dirty: 1, updatedAt: new Date('2026-11-09T10:00:00').getTime() })
  })

  it('does not write the profile on a normal quest tick', async () => {
    await ensureDay('2026-11-09')
    const stamp = (await db.profile.get('me'))!.updatedAt
    setToday('2026-11-09T11:00:00')
    const q = (await db.days.get('2026-11-09'))!.quests[1]!
    await setQuestDone('2026-11-09', q.id, true)
    expect((await db.profile.get('me'))!.updatedAt).toBe(stamp)
  })
})

describe('level-up moments', () => {
  it('celebrates a level-up once, and a rank-up with the new rank', async () => {
    // Pretend the user already has nearly enough XP for level 5 (rank D).
    await db.days.put({
      date: '2026-10-01',
      quests: [{ id: 'old', title: 'Old', xp: totalXpForLevel(5) - 100, kind: 'check', done: true }],
      updatedAt: 0,
    })
    await checkMilestones()
    await dismissCelebration()
    await ensureDay('2026-11-09')
    const train = (await db.days.get('2026-11-09'))!.quests[0]!
    await setQuestDone('2026-11-09', train.id, true)

    expect((await progress()).level).toBe(5)
    expect(await db.profile.get('me')).toMatchObject({ bestLevel: 5, rank: 'D' })
    expect(await getCelebration()).toEqual({ level: 5, rank: 'D' })

    await dismissCelebration()
    await setQuestDone('2026-11-09', train.id, false)
    await setQuestDone('2026-11-09', train.id, true)
    expect(await getCelebration()).toBeUndefined()
    expect((await db.profile.get('me'))?.rank).toBe('D')
  })
})
