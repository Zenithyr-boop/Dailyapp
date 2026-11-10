import { db, recordKey, SYNCED_TABLES, type CustomMovement, type Day, type QuestDef, type SyncedRecord, type SyncedTable } from '../db'
import { createCustomMovement, deleteCustomMovement } from '../../features/train/library/customMovements'
import { DEFAULT_QUESTS, ensureDay, ensureSetup, listQuestDefs, setQuestDone } from '../../features/quests/questsRepo'
import { countPending, getSyncStatus, startSync, stopSync } from './engine'
import type { RemoteBatch, RemoteStore } from './remote'

/** In-memory stand-in for Firestore: one account, server clock, live listeners. */
class FakeCloud {
  docs = new Map<string, { table: SyncedTable; record: SyncedRecord; syncedAt: number }>()
  clock = 1000
  writes = 0
  private listeners: { table: SyncedTable; since: number; fn: (b: RemoteBatch) => void }[] = []

  private notify(table: SyncedTable, record: SyncedRecord, syncedAt: number) {
    for (const l of this.listeners) {
      if (l.table === table && syncedAt > l.since) l.fn({ records: [record], maxSyncedAt: syncedAt })
    }
  }

  /** Another device writes to the account. */
  put(table: SyncedTable, record: SyncedRecord) {
    const syncedAt = ++this.clock
    const clean = { ...record } as SyncedRecord & { dirty?: unknown }
    delete clean.dirty
    this.docs.set(`${table}/${recordKey(table, record)}`, { table, record: clean, syncedAt })
    this.notify(table, clean, syncedAt)
  }

  records(table: SyncedTable) {
    return [...this.docs.values()].filter((d) => d.table === table).map((d) => d.record)
  }

  remote(): RemoteStore {
    return {
      fetchAll: async () => {
        const out = {} as Record<SyncedTable, RemoteBatch>
        for (const t of SYNCED_TABLES) {
          const docs = [...this.docs.values()].filter((d) => d.table === t)
          out[t] = { records: docs.map((d) => d.record), maxSyncedAt: Math.max(0, ...docs.map((d) => d.syncedAt)) }
        }
        return out
      },
      listen: (table, since, fn) => {
        const l = { table, since, fn }
        this.listeners.push(l)
        const docs = [...this.docs.values()].filter((d) => d.table === table && d.syncedAt > since)
        if (docs.length) queueMicrotask(() => fn({ records: docs.map((d) => d.record), maxSyncedAt: Math.max(...docs.map((d) => d.syncedAt)) }))
        return () => {
          this.listeners = this.listeners.filter((x) => x !== l)
        }
      },
      upload: async (items) => {
        this.writes += items.length
        for (const { table, record } of items) this.put(table, record)
      },
      deleteAll: async () => {
        this.docs.clear()
      },
    }
  }
}

let cloud: FakeCloud

function start(uid = 'u1') {
  startSync(uid, { createRemote: async () => cloud.remote(), defaultQuests: DEFAULT_QUESTS, debounceMs: 0 })
}

async function settled() {
  await vi.waitFor(
    async () => {
      expect(getSyncStatus().state).toBe('synced')
      expect(await countPending()).toBe(0)
    },
    { timeout: 3000 },
  )
}

const today = '2026-11-09'

beforeEach(async () => {
  stopSync()
  cloud = new FakeCloud()
  await db.delete()
  await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${today}T09:00:00`))
})

afterEach(() => {
  stopSync()
  vi.useRealTimers()
})

describe('first sign-in', () => {
  it('uploads everything on this device when the account is empty', async () => {
    await ensureSetup()
    await ensureDay(today)
    start()
    await settled()
    expect(cloud.records('quests')).toHaveLength(6)
    expect(cloud.records('days')).toHaveLength(1)
    expect(cloud.records('profile')).toHaveLength(1)
    expect(cloud.records('days')[0]).not.toHaveProperty('dirty')
  })

  it("takes the account's data on an untouched device (no duplicate starter quests)", async () => {
    // The account: one custom quest and a ticked day.
    const q: QuestDef = { id: 'acct-q', title: 'Cold shower', xp: 60, kind: 'check', order: 0, updatedAt: 1 }
    cloud.put('quests', q)
    cloud.put('days', { date: '2026-11-08', quests: [{ ...q, done: true, at: 5 }], updatedAt: 5 } as Day)
    // This device: brand new.
    await ensureSetup()
    await ensureDay(today)
    start()
    await settled()
    expect((await listQuestDefs()).map((d) => d.title)).toEqual(['Cold shower'])
    expect((await db.days.get('2026-11-08'))?.quests[0]?.done).toBe(true)
  })

  it('merges a used device into an account with data, matching starter quests by name', async () => {
    // Account made on the phone: starter quests with its own ids, "Train" ticked today.
    await ensureSetup()
    const phoneDefs = (await listQuestDefs()).map((d, i) => ({ ...d, id: `phone-${i}` }))
    phoneDefs.forEach((d) => cloud.put('quests', d))
    cloud.put('days', {
      date: today,
      quests: phoneDefs.map((d) => ({ id: d.id, title: d.title, xp: d.xp, kind: d.kind, done: d.title === 'Train', at: 50 })),
      updatedAt: 50,
    } as Day)
    // This laptop: same starter quests (different ids), "Read 10 pages" ticked, plus its own quest.
    await ensureDay(today)
    const read = (await db.days.get(today))!.quests.find((x) => x.title === 'Read 10 pages')!
    await setQuestDone(today, read.id, true)
    await db.quests.put({ id: 'laptop-own', title: 'Stretch', xp: 20, kind: 'check', order: 9, updatedAt: 1 })

    start()
    await settled()

    const defs = await listQuestDefs()
    expect(defs).toHaveLength(7) // six shared starters + Stretch, no duplicates
    expect(defs.filter((d) => d.id.startsWith('phone-'))).toHaveLength(6)
    const merged = (await db.days.get(today))!
    const done = merged.quests.filter((x) => x.done).map((x) => x.title).sort()
    expect(done).toEqual(['Read 10 pages', 'Train'])
    // …and the cloud got the merged day and the laptop's own quest.
    const cloudDay = cloud.records('days').find((d) => (d as Day).date === today) as Day
    expect(cloudDay.quests.filter((x) => x.done)).toHaveLength(2)
    expect(cloud.records('quests').map((r) => (r as QuestDef).title)).toContain('Stretch')
  })
})

describe('ongoing sync', () => {
  beforeEach(async () => {
    await ensureSetup()
    await ensureDay(today)
    start()
    await settled()
  })

  it('uploads local changes and clears their flags', async () => {
    const before = cloud.writes
    const q = (await db.days.get(today))!.quests[0]!
    await setQuestDone(today, q.id, true)
    await settled()
    expect(cloud.writes).toBe(before + 1) // just the day; no profile write on a tick
    const cloudDay = cloud.records('days')[0] as Day
    expect(cloudDay.quests[0]!.done).toBe(true)
  })

  it("applies another device's change without uploading it back", async () => {
    const day = (await db.days.get(today))!
    const before = cloud.writes
    vi.setSystemTime(new Date(`${today}T10:00:00`))
    cloud.put('days', { ...day, quests: day.quests.map((q, i) => (i === 1 ? { ...q, done: true, at: Date.now() } : q)), updatedAt: Date.now() } as Day)
    await vi.waitFor(async () => expect((await db.days.get(today))!.quests[1]!.done).toBe(true))
    await settled()
    expect(cloud.writes).toBe(before)
  })

  it('syncs custom movements both ways, including deletes', async () => {
    const id = await createCustomMovement({
      name: 'Landmine Press',
      primaryMuscles: ['shoulders'],
      secondaryMuscles: [],
      equipment: 'barbell',
      category: 'strength',
      tracking: 'weight_reps',
      instructions: [],
    })
    await settled()
    expect(cloud.records('movements')).toEqual([expect.objectContaining({ id, name: 'Landmine Press' })])

    vi.setSystemTime(new Date(`${today}T10:00:00`))
    const other = { ...(cloud.records('movements')[0] as CustomMovement), name: 'Landmine press (renamed)', updatedAt: Date.now() }
    cloud.put('movements', other)
    await vi.waitFor(async () => expect((await db.movements.get(id))?.name).toBe('Landmine press (renamed)'))

    vi.setSystemTime(new Date(`${today}T11:00:00`))
    await deleteCustomMovement(id)
    await settled()
    expect((cloud.records('movements')[0] as CustomMovement).deleted).toBe(1)
  })

  it('waits while offline and uploads when back online', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    const q = (await db.days.get(today))!.quests[2]!
    await setQuestDone(today, q.id, true)
    await vi.waitFor(() => expect(getSyncStatus().state).toBe('offline'))
    expect(await countPending()).toBe(1)

    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await settled()
    expect((cloud.records('days')[0] as Day).quests[2]!.done).toBe(true)
    online.mockRestore()
  })
})
