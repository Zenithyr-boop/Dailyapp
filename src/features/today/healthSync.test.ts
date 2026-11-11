import { db } from '../../lib/db'
import { addDays, dayKeyAt } from '../../lib/day'
import type { HealthByDay } from '../../lib/health/days'
import { startAutoQuests } from '../quests/autoQuests'
import { addQuest, ensureSetup } from '../quests/questsRepo'
import { saveStats } from './statsRepo'
import { connectHealth, disconnectHealth, getHealthState, syncHealth } from './healthSync'

// Pretend to be the Android app with a fake Health Connect.
const fake = vi.hoisted(() => ({ days: {} as HealthByDay, granted: ['steps', 'sleep', 'weight'] as string[], reads: 0 }))

vi.mock('../../lib/platform', () => ({ isNativeApp: () => true, isAndroidApp: () => true }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) } }))
vi.mock('../../lib/health/bridge', () => ({
  HEALTH_METRICS: ['steps', 'sleep', 'weight'],
  requestHealthAccess: vi.fn(async (metrics: string[]) => metrics.filter((m) => fake.granted.includes(m))),
  grantedHealthMetrics: vi.fn(async () => fake.granted),
  readHealthDays: vi.fn(async (from: string, to: string) => {
    fake.reads++
    return Object.fromEntries(Object.entries(fake.days).filter(([d]) => d >= from && d <= to))
  }),
}))

const quest = async (date: string, title: string) => (await db.days.get(date))?.quests.find((q) => q.title === title)

let stop: (() => void) | undefined

beforeEach(async () => {
  stop?.()
  await db.delete()
  await db.open()
  await ensureSetup()
  fake.days = {}
  fake.granted = ['steps', 'sleep', 'weight']
  fake.reads = 0
})

afterAll(() => stop?.())

describe('Health Connect sync', () => {
  it('does nothing until the user connects', async () => {
    const today = dayKeyAt()
    fake.days = { [today]: { steps: 9000 } }
    expect(await syncHealth({ force: true })).toBe(0)
    expect(fake.reads).toBe(0)
    expect((await db.days.get(today))?.steps).toBeUndefined()
  })

  it('writes steps, sleep and weight with their change stamps, and linked quests tick themselves', async () => {
    const today = dayKeyAt()
    await addQuest({ title: 'Sleep 7 h', xp: 40, kind: 'check', link: { source: 'sleep', target: 420 } })
    await addQuest({ title: 'Weigh in', xp: 20, kind: 'check', link: { source: 'weighIn' } })
    // The real automatic-quest engine, as started in main.tsx.
    stop = startAutoQuests()

    fake.days = { [today]: { steps: 8200, sleepMinutes: 450, weightKg: 81.4 } }
    expect(await connectHealth(['steps', 'sleep', 'weight'])).toEqual(['steps', 'sleep', 'weight'])

    const day = (await db.days.get(today))!
    expect(day).toMatchObject({ steps: 8200, sleepMinutes: 450, weightKg: 81.4, dirty: 1 })
    expect(day.statsAt?.steps).toBeGreaterThan(0)
    expect(day.statsAt?.sleepMinutes).toBeGreaterThan(0)
    expect(day.bodyAt?.weightKg).toBeGreaterThan(0)
    // Profile weight follows the latest weigh-in, as for a typed one.
    expect((await db.profile.get('me'))?.body?.weightKg).toBe(81.4)

    await vi.waitFor(async () => {
      expect((await quest(today, 'Walk 8,000 steps'))?.done).toBe(true)
      expect((await quest(today, 'Sleep 7 h'))?.done).toBe(true)
      expect((await quest(today, 'Weigh in'))?.done).toBe(true)
    })
  })

  it('fills the last 30 days on connect, then only reads from the day before the last sync', async () => {
    const today = dayKeyAt()
    const old = addDays(today, -29)
    fake.days = { [old]: { steps: 5000 }, [addDays(today, -30)]: { steps: 1 }, [today]: { steps: 100 } }
    await connectHealth(['steps'])
    expect((await db.days.get(old))?.steps).toBe(5000)
    expect(await db.days.get(addDays(today, -30))).toBeUndefined()

    fake.days[old] = { steps: 6000 } // too old for the next sync to look at
    fake.days[today] = { steps: 2500 }
    await syncHealth({ force: true })
    expect((await db.days.get(old))?.steps).toBe(5000)
    expect((await db.days.get(today))?.steps).toBe(2500)
  })

  it('keeps a hand-corrected value until Health Connect reports a new one', async () => {
    const today = dayKeyAt()
    fake.days = { [today]: { steps: 3000 } }
    await connectHealth(['steps'])
    await saveStats(today, { steps: 3500 })

    await syncHealth({ force: true })
    expect((await db.days.get(today))?.steps).toBe(3500)

    fake.days = { [today]: { steps: 4000 } }
    await syncHealth({ force: true })
    expect((await db.days.get(today))?.steps).toBe(4000)
  })

  it('reads only what the user chose and Health Connect allowed, and stops when disconnected', async () => {
    const today = dayKeyAt()
    fake.granted = ['steps']
    fake.days = { [today]: { steps: 7000 } }
    expect(await connectHealth(['steps', 'weight'])).toEqual(['steps'])
    expect((await getHealthState()).granted).toEqual(['steps'])

    await disconnectHealth()
    fake.days = { [today]: { steps: 9000 } }
    expect(await syncHealth({ force: true })).toBe(0)
    expect((await db.days.get(today))?.steps).toBe(7000)
  })

  it('stays off when Health Connect allows nothing', async () => {
    fake.granted = []
    expect(await connectHealth(['steps'])).toEqual([])
    expect((await getHealthState()).connected).toBe(false)
  })
})
