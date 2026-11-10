import Dexie from 'dexie'
import { db } from './db'

describe('db', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('stores and reads a day by its key', async () => {
    await db.days.put({
      date: '2026-11-09',
      quests: [{ id: 'q1', title: 'Drink 3L water', xp: 20, kind: 'count', target: 3, unit: 'L', value: 0, done: false }],
      updatedAt: Date.now(),
    })
    const day = await db.days.get('2026-11-09')
    expect(day?.quests[0]?.title).toBe('Drink 3L water')
  })

  it('queries food entries by date', async () => {
    const base = { name: 'Oats', grams: 80, meal: 'breakfast' as const, loggedAt: 0, kcal: 300, proteinG: 10, carbsG: 54, fatG: 6, updatedAt: 0 }
    await db.food.bulkPut([
      { ...base, id: 'a', date: '2026-11-09' },
      { ...base, id: 'b', date: '2026-11-08' },
    ])
    expect(await db.food.where('date').equals('2026-11-09').count()).toBe(1)
  })
})

describe('v6 upgrade (onboarding)', () => {
  it('marks profiles that existed before onboarding as done, and flags them for upload', async () => {
    db.close()
    await Dexie.delete('chalk')
    const old = new Dexie('chalk')
    old.version(5).stores({ profile: 'id, dirty' })
    await old.open()
    await old.table('profile').put({ id: 'me', displayName: 'Sam', units: 'metric', rank: 'D', bestLevel: 6, goals: {}, updatedAt: 1 })
    old.close()

    await db.open()
    const p = await db.profile.get('me')
    expect(p).toMatchObject({ onboarding: 'done', dirty: 1, rank: 'D' })
    expect(p!.updatedAt).toBeGreaterThan(1)
  })
})
