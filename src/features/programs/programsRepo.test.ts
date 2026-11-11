import { addDays, getToday } from '../../lib/day'
import { db, type QuestFields } from '../../lib/db'
import { progressFromDays } from '../../lib/xp'
import { useManualQuests } from '../../test/manualQuests'
import { closeOutDays } from '../quests/closeOut'
import { addQuest, deleteQuest, ensureDay, ensureSetup, listQuestDefs, ProgramQuestError, setQuestDone, updateQuest } from '../quests/questsRepo'
import {
  ActiveProgramError,
  dismissProgramCelebration,
  endProgram,
  getActiveProgram,
  getProgramCelebration,
  refreshPrograms,
  startProgram,
} from './programsRepo'
import { programBonus } from './templates'

// Only Date is faked: IndexedDB (fake-indexeddb) needs real timers.
const setNow = (isoLocal: string) => vi.setSystemTime(new Date(isoLocal))
const START = '2026-11-02'
const at = (date: string) => setNow(`${date}T09:00:00`)

const RULES: QuestFields[] = [
  { title: 'Read 10 pages', xp: 30, kind: 'check' }, // the user already has this one
  { title: 'Meditate', xp: 20, kind: 'check' },
]

async function tickRules(date: string, programId: string) {
  const day = await db.days.get(date)
  for (const q of day!.quests) if (q.programId === programId) await setQuestDone(date, q.id, true)
}

/** Move to `date`, open the app (close out days, refresh programs). */
async function openOn(date: string) {
  at(date)
  await closeOutDays()
  await refreshPrograms()
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at(START)
  await db.delete()
  await db.open()
  await ensureSetup()
  await useManualQuests()
  await ensureDay()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('starting and ending a program', () => {
  it('adds the rules as tagged quests, taking over a matching quest instead of doubling it', async () => {
    const before = await listQuestDefs()
    const read = before.find((q) => q.title === 'Read 10 pages')!
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: false, rules: RULES })

    const defs = await listQuestDefs()
    expect(defs).toHaveLength(before.length + 1) // only Meditate is new
    expect(defs.find((q) => q.id === read.id)).toMatchObject({ programId: id, xp: 30 })
    expect(defs.find((q) => q.title === 'Meditate')).toMatchObject({ programId: id })

    const today = await db.days.get(START)
    expect(today!.quests.filter((q) => q.programId === id).map((q) => q.title)).toEqual(['Read 10 pages', 'Meditate'])
    expect(await getActiveProgram()).toMatchObject({ id, startDate: START, status: 'active', adopted: [{ questId: read.id }] })
  })

  it('takes over an automatic quest with the same link, uses the program’s target, and gives it back', async () => {
    const waterId = await addQuest({ title: 'Drink 2.5 L water', xp: 20, kind: 'check', link: { source: 'water', target: 2500 } })
    const id = await startProgram({
      kind: '75-day-challenge',
      name: '75-day challenge',
      length: 75,
      strict: true,
      rules: [{ title: 'Drink 3.8 L water', xp: 40, kind: 'check', link: { source: 'water', target: 3800 } }],
    })
    expect((await listQuestDefs()).filter((q) => q.link?.source === 'water')).toMatchObject([{ id: waterId, programId: id, link: { target: 3800 } }])
    // One program at a time.
    await expect(startProgram({ kind: 'custom', name: 'Other', length: 7, strict: false, rules: RULES })).rejects.toBeInstanceOf(ActiveProgramError)

    await endProgram(id)
    expect(await db.quests.get(waterId)).toMatchObject({ title: 'Drink 2.5 L water', xp: 20, link: { target: 2500 } })
  })

  it('keeps program quests from being deleted, and their tag through edits', async () => {
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: false, rules: RULES })
    const meditate = (await listQuestDefs()).find((q) => q.title === 'Meditate')!
    await expect(deleteQuest(meditate.id)).rejects.toBeInstanceOf(ProgramQuestError)
    await updateQuest(meditate.id, { title: 'Meditate 10 min', xp: 40, kind: 'check' })
    expect(await db.quests.get(meditate.id)).toMatchObject({ title: 'Meditate 10 min', programId: id })
  })

  it('ending removes the quests it added, gives back the ones it took over, and records the attempt', async () => {
    const read = (await listQuestDefs()).find((q) => q.title === 'Read 10 pages')!
    await db.quests.update(read.id, { xp: 50 }) // the user's own XP, given back at the end
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: false, rules: RULES })
    await tickRules(START, id)
    await endProgram(id)

    const defs = await listQuestDefs()
    expect(defs.some((q) => q.title === 'Meditate')).toBe(false)
    expect(defs.find((q) => q.id === read.id)).toEqual(expect.objectContaining({ xp: 50 }))
    expect(defs.find((q) => q.id === read.id)).not.toHaveProperty('programId')
    expect((await db.days.get(START))!.quests.some((q) => q.programId)).toBe(false)
    expect(await db.programs.get(id)).toMatchObject({
      status: 'ended',
      endDate: START,
      attempts: [{ startDate: START, endDate: START, daysDone: 1, end: 'ended' }],
    })
    expect(await getActiveProgram()).toBeUndefined()
  })
})

describe('the program engine', () => {
  it('strict: a closed miss restarts at day 1 and keeps the attempt', async () => {
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: true, rules: RULES })
    await tickRules(START, id)
    await openOn(addDays(START, 1)) // day 2: not ticked
    await openOn(addDays(START, 2)) // day 2 is still open (yesterday)
    expect((await db.programs.get(id))!.attempts).toEqual([])

    await openOn(addDays(START, 3)) // day 2 closed without its rules
    expect(await db.programs.get(id)).toMatchObject({
      status: 'active',
      startDate: addDays(START, 2),
      attempts: [{ startDate: START, endDate: addDays(START, 1), daysDone: 1, end: 'missed' }],
    })
  })

  it('not strict: a miss is marked and the program carries on', async () => {
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: false, rules: RULES })
    await openOn(addDays(START, 4))
    expect(await db.programs.get(id)).toMatchObject({ startDate: START, attempts: [] })
  })

  it('finishing adds the badge, the XP bonus on the last day and a celebration; the quests leave the next day', async () => {
    const id = await startProgram({ kind: 'custom', name: 'Week one', length: 7, strict: true, rules: RULES })
    for (let i = 0; i < 7; i++) {
      const date = addDays(START, i)
      await openOn(date)
      await tickRules(date, id)
    }
    const last = addDays(START, 6)
    await refreshPrograms(last)

    const xp = programBonus(7)
    expect(await db.programs.get(id)).toMatchObject({ status: 'finished', endDate: last, daysDone: 7, bonusXp: xp })
    expect((await db.days.get(last))!.bonuses).toEqual([{ id, label: 'Week one complete', xp }])
    expect(await getProgramCelebration()).toMatchObject({ programId: id, xp, daysDone: 7, length: 7 })
    // The last day's quests (and their XP) stay until the day is over.
    expect((await db.days.get(last))!.quests.filter((q) => q.programId === id)).toHaveLength(2)
    const total = progressFromDays(await db.days.toArray(), last).totalXp
    await refreshPrograms(last) // nothing more to do: no second bonus
    expect(progressFromDays(await db.days.toArray(), last).totalXp).toBe(total)

    await dismissProgramCelebration()
    await openOn(addDays(START, 7))
    expect((await listQuestDefs()).some((q) => q.programId)).toBe(false)
    expect(await db.programs.get(id)).toMatchObject({ released: true })
    expect((await db.days.get(await getToday()))!.quests.some((q) => q.programId)).toBe(false)
    expect(await getProgramCelebration()).toBeUndefined()
  })

  it('puts the running program’s rules on a today record that is missing them', async () => {
    const id = await startProgram({ kind: 'custom', name: 'Focus', length: 10, strict: false, rules: RULES })
    const day = (await db.days.get(START))!
    await db.days.put({ ...day, quests: day.quests.filter((q) => q.programId !== id) })
    await refreshPrograms(START)
    expect((await db.days.get(START))!.quests.filter((q) => q.programId === id)).toHaveLength(2)
  })
})
