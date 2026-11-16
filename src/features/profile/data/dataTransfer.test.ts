import { db, type FoodEntry } from '../../../lib/db'
import { toCsv } from '../../../lib/csv'
import { crc32, makeZip } from '../../../lib/zip'
import { addQuest, ensureDay, ensureSetup, listQuestDefs, setQuestDone } from '../../quests/questsRepo'
import { useManualQuests } from '../../../test/manualQuests'
import { exportCsvZip, exportJson, importData } from './dataTransfer'
import { foodCsv, ImportError, parseExport } from './exportFormat'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T09:00:00'))
  await db.delete()
  await db.open()
  await ensureSetup()
  await useManualQuests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks, and defuses formulas', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], ['=SUM(A1)', -5], [undefined, true]])).toBe(
      'a,b\r\n"x, y","say ""hi"""\r\n\'=SUM(A1),-5\r\n,yes\r\n',
    )
  })
})

describe('makeZip', () => {
  it('writes a valid stored zip', () => {
    const zip = makeZip([{ name: 'a.csv', content: 'hello' }], new Date('2026-11-16T09:00:00'))
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hello')))
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
    // End of central directory: one entry.
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(zip.length - 12, true)).toBe(1)
  })
})

describe('parseExport', () => {
  it('rejects files that are not exports', () => {
    expect(() => parseExport('not json')).toThrow(ImportError)
    expect(() => parseExport('{"app":"Other","tables":{}}')).toThrow(ImportError)
    expect(() => parseExport('{"app":"FromZero","format":99,"tables":{}}')).toThrow(/newer version/)
    expect(() => parseExport('{"app":"FromZero","format":1,"tables":{}}')).toThrow(/empty/)
  })

  it('skips damaged records', () => {
    const parsed = parseExport(
      JSON.stringify({
        app: 'FromZero',
        format: 1,
        tables: { days: [{ date: '2026-11-01', quests: [] }, { date: 'yesterday', quests: [] }, 'junk'] },
      }),
    )
    expect(parsed.counts).toEqual({ days: 1 })
    expect(parsed.skipped).toBe(2)
  })
})

describe('export → import', () => {
  async function seedUser() {
    await ensureDay('2026-11-16')
    const [first] = await listQuestDefs()
    await setQuestDone('2026-11-16', first!.id, true)
    await db.profile.update('me', { displayName: 'Sam', goals: { kcal: 2400 } })
    await db.food.put({
      id: 'f1',
      date: '2026-11-16',
      meal: 'lunch',
      loggedAt: Date.now(),
      name: 'Chicken, rice',
      kcal: 500,
      proteinG: 40,
      carbsG: 50,
      fatG: 12,
      updatedAt: Date.now(),
    } as FoodEntry)
  }

  it('restores everything on a fresh device, without doubling the starter quests', async () => {
    await seedUser()
    await addQuest({ title: 'Stretch', xp: 20, kind: 'check' })
    const json = (await exportJson()).data as string
    const before = (await listQuestDefs()).map((q) => q.title)

    // A new device: fresh profile and starter quests.
    await db.delete()
    await db.open()
    await ensureSetup()
    await ensureDay('2026-11-16')

    const result = await importData(parseExport(json))
    expect(result.added).toBeGreaterThan(0)
    expect((await listQuestDefs()).map((q) => q.title)).toEqual(before)
    const today = await db.days.get('2026-11-16')
    expect(today?.quests.filter((q) => q.done)).toHaveLength(1)
    expect((await db.profile.get('me'))?.displayName).toBe('Sam')
    expect(await db.food.get('f1')).toMatchObject({ name: 'Chicken, rice', dirty: 1 })
  })

  it('merges into a used device: keeps local data, ticks from both, nothing deleted', async () => {
    await seedUser()
    const json = (await exportJson()).data as string

    // Keep using the device: a new food and a second tick.
    const [, second] = await listQuestDefs()
    await setQuestDone('2026-11-16', second!.id, true)
    await db.food.put({ ...(await db.food.get('f1'))!, id: 'f2', name: 'Apple', kcal: 95 })

    const result = await importData(parseExport(json))
    expect(result.added).toBe(0)
    expect(await db.food.count()).toBe(2)
    const today = await db.days.get('2026-11-16')
    expect(today?.quests.filter((q) => q.done)).toHaveLength(2)

    // Importing the same file twice changes nothing.
    const again = await importData(parseExport(json))
    expect(again.added + again.updated).toBe(0)
  })

  it('writes the CSV zip with all four files', async () => {
    await seedUser()
    const { name, data } = await exportCsvZip(new Date('2026-11-16T09:00:00'))
    expect(name).toBe('FromZero-export-2026-11-16-csv.zip')
    const text = new TextDecoder().decode(data as Uint8Array)
    for (const f of ['days.csv', 'quests.csv', 'food.csv', 'workouts.csv']) expect(text).toContain(f)
    expect(foodCsv(await db.food.toArray())).toContain('"Chicken, rice"')
  })
})
