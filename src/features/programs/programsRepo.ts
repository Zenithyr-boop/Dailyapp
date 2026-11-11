/**
 * Programs data access and engine (local Dexie; the `programs` table syncs to
 * `users/{uid}/programs`).
 *
 * Starting a program turns its rules into quests tagged with `programId`. A
 * quest the user already has (same automatic link, or same title and type) is
 * taken over instead of doubled, and given back as it was when the program is
 * over. Progress is derived from the day records (`progress.ts`); the engine
 * only saves what follows from it: strict restarts, and the finish (badge,
 * XP bonus on the last day's record, a celebration on this device).
 */
import { liveQuery, type Subscription } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, setMeta, type AdoptedQuest, type ProgramState, type QuestDef, type QuestFields } from '../../lib/db'
import { addDays, dayClock, getToday } from '../../lib/day'
import { freshQuest } from '../quests/progress'
import { applyQuestsToToday, checkMilestones, dayForWrite, ensureSetup, listQuestDefs, normalizeFields } from '../quests/questsRepo'
import { evaluateProgram, type ProgramProgress } from './progress'
import { clampLength, programBonus, PROGRAM_RULES_MAX, templateById } from './templates'

export class ActiveProgramError extends Error {
  constructor(name: string) {
    super(`${name} is still running: end it before starting another program`)
  }
}

export interface NewProgram {
  kind: string
  name: string
  length: number
  strict: boolean
  rules: readonly QuestFields[]
}

/** The running program, if any. */
export async function getActiveProgram(): Promise<ProgramState | undefined> {
  return (await db.programs.where('status').equals('active').toArray()).find((p) => !p.deleted)
}

/** Every program (newest first), without deleted ones. */
export async function listPrograms(): Promise<ProgramState[]> {
  const all = (await db.programs.toArray()).filter((p) => !p.deleted)
  return all.sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
}

export function usePrograms(): ProgramState[] | undefined {
  return useLiveQuery(listPrograms, [])
}

/** Program names by id, for the tags on quests (kept after a program is over, for history). */
export function useProgramNames(): Map<string, string> | undefined {
  const programs = usePrograms()
  return programs && new Map(programs.map((p) => [p.id, p.name]))
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A quest the user already has that a rule can take over. */
function matches(def: QuestDef, rule: QuestFields): boolean {
  if (def.link || rule.link) return !!def.link && !!rule.link && def.link.source === rule.link.source
  return def.kind === rule.kind && sameName(def.title, rule.title)
}

/** A quest definition's own fields (what `adopted.before` keeps). */
function fieldsOf(def: QuestDef): QuestFields {
  const { title, xp, kind, target, unit, step, link } = def
  return normalizeFields({ title, xp, kind, target, unit, step, link })
}

/** Start a program: its rules join the quest list today (day 1). Only one runs at a time. */
export async function startProgram(input: NewProgram): Promise<string> {
  await ensureSetup()
  const today = await getToday()
  const id = crypto.randomUUID()
  const rules = input.rules.slice(0, PROGRAM_RULES_MAX).map(normalizeFields)
  if (rules.length === 0) throw new Error('A program needs at least one rule')
  const name = input.name.trim() || templateById(input.kind)?.name || 'Program'

  await db.transaction('rw', db.programs, db.quests, async () => {
    const active = await getActiveProgram()
    if (active) throw new ActiveProgramError(active.name)
    const defs = await listQuestDefs()
    const free = defs.filter((d) => !d.programId)
    let order = (defs.at(-1)?.order ?? -1) + 1
    const now = Date.now()
    const adopted: AdoptedQuest[] = []
    const questIds: string[] = []
    const writes: QuestDef[] = []
    for (const rule of rules) {
      const i = free.findIndex((d) => matches(d, rule))
      if (i >= 0) {
        const def = free.splice(i, 1)[0]!
        adopted.push({ questId: def.id, before: fieldsOf(def) })
        writes.push({ id: def.id, order: def.order, ...rule, programId: id, updatedAt: now })
      } else {
        const questId = crypto.randomUUID()
        questIds.push(questId)
        writes.push({ id: questId, order: order++, ...rule, programId: id, updatedAt: now })
      }
    }
    await db.quests.bulkPut(writes)
    await db.programs.put({
      id,
      kind: input.kind,
      name,
      length: clampLength(input.length),
      strict: input.strict,
      rules,
      startDate: today,
      attempts: [],
      status: 'active',
      questIds,
      adopted,
      updatedAt: now,
    })
  })
  await applyQuestsToToday()
  return id
}

/** Remove the quests a program added and give back the ones it took over. */
async function releaseQuests(program: ProgramState): Promise<void> {
  await db.transaction('rw', db.quests, async () => {
    const now = Date.now()
    for (const questId of program.questIds) {
      const def = await db.quests.get(questId)
      if (def && !def.deleted) await db.quests.update(questId, { deleted: 1 })
    }
    for (const { questId, before } of program.adopted) {
      const def = await db.quests.get(questId)
      if (def && !def.deleted && def.programId === program.id) {
        await db.quests.put({ id: questId, order: def.order, ...before, updatedAt: now })
      }
    }
  })
}

/** Stop the running program. Its quests leave today's list; the attempt goes on record. */
export async function endProgram(id: string): Promise<void> {
  const today = await getToday()
  const program = await db.programs.get(id)
  if (!program || program.status !== 'active') return
  const p = await progressOf(program, today)
  await db.programs.update(id, {
    status: 'ended',
    startDate: p.startDate,
    endDate: today,
    attempts: [...program.attempts, ...p.newAttempts, { startDate: p.startDate, endDate: today, daysDone: p.daysDone, end: 'ended' }],
    released: true,
  })
  await releaseQuests(program)
  await applyQuestsToToday()
}

/** A program finish waiting to be celebrated on this device. Never synced. */
export interface ProgramCelebration {
  programId: string
  name: string
  xp: number
  daysDone: number
  length: number
}

const CELEBRATION_KEY = 'programCelebration'

export function getProgramCelebration(): Promise<ProgramCelebration | undefined> {
  return getMeta<ProgramCelebration>(CELEBRATION_KEY)
}

export function dismissProgramCelebration(): Promise<void> {
  return setMeta(CELEBRATION_KEY, undefined)
}

/**
 * Bring the programs up to date with the day records: save strict restarts,
 * finish a program whose days are all in, give back a finished program's
 * quests once its last day is over, and make sure today's record holds the
 * running program's rules. Writes only when something changed.
 */
export async function refreshPrograms(today?: string, { celebrate = true } = {}): Promise<void> {
  const key = today ?? (await getToday())
  const programs = (await db.programs.toArray()).filter((p) => !p.deleted)

  // A finished program keeps its quests to the end of its last day (so that day's ticks and XP stay).
  for (const p of programs) {
    if (p.status === 'finished' && !p.released && p.endDate && key > p.endDate) {
      await releaseQuests(p)
      await db.programs.update(p.id, { released: true })
      await applyQuestsToToday()
    }
  }

  const program = programs.find((p) => p.status === 'active')
  if (!program) return
  await ensureRulesToday(program, key)
  const p = await progressOf(program, key)

  if (!p.finished) {
    if (p.newAttempts.length) {
      await db.programs.update(program.id, { attempts: [...program.attempts, ...p.newAttempts], startDate: p.startDate })
    }
    return
  }

  const xp = programBonus(program.length)
  await db.transaction('rw', db.programs, db.days, db.quests, async () => {
    const fresh = await db.programs.get(program.id)
    if (!fresh || fresh.status !== 'active') return
    await db.programs.update(program.id, {
      status: 'finished',
      startDate: p.startDate,
      endDate: p.lastDate,
      daysDone: p.daysDone,
      bonusXp: xp,
      attempts: [...program.attempts, ...p.newAttempts, { startDate: p.startDate, endDate: p.lastDate, daysDone: p.daysDone, end: 'finished' }],
    })
    const day = await dayForWrite(p.lastDate)
    const bonuses = (day.bonuses ?? []).filter((b) => b.id !== program.id)
    await db.days.put({ ...day, bonuses: [...bonuses, { id: program.id, label: `${program.name} complete`, xp }], updatedAt: Date.now() })
  })
  if (celebrate) {
    await setMeta(CELEBRATION_KEY, { programId: program.id, name: program.name, xp, daysDone: p.daysDone, length: program.length } satisfies ProgramCelebration)
  }
  // Last day already over (not strict, finished once it closed): give the quests back now.
  if (key > p.lastDate) await refreshPrograms(key, { celebrate: false })
  await checkMilestones(key)
}

/**
 * Today's record must hold every rule of the running program (a record made on
 * another device before its quest list arrived could miss them).
 */
async function ensureRulesToday(program: ProgramState, today: string): Promise<void> {
  await db.transaction('rw', db.days, db.quests, async () => {
    const day = await db.days.get(today)
    if (!day || day.deleted) return
    const have = new Set(day.quests.map((q) => q.id))
    const missing = (await listQuestDefs()).filter((d) => d.programId === program.id && !have.has(d.id))
    if (missing.length === 0) return
    await db.days.put({ ...day, quests: [...day.quests, ...missing.map(freshQuest)], updatedAt: Date.now() })
  })
}

/** A program's progress from the day records on this device. */
async function progressOf(program: ProgramState, today: string): Promise<ProgramProgress> {
  const days = await db.days.where('date').between(program.startDate, today, true, true).toArray()
  const byDate = new Map(days.map((d) => [d.date, d]))
  return evaluateProgram(program, (d) => byDate.get(d), today)
}

/**
 * Keep programs up to date while the app is open: re-check whenever programs
 * or the days since the running program started change, and on every new day.
 */
export function startPrograms(): () => void {
  let sub: Subscription | undefined
  let queue: Promise<unknown> = Promise.resolve()
  const run = (today: string) => {
    queue = queue.then(() => refreshPrograms(today)).catch(() => {})
  }

  const watch = (today: string) => {
    sub?.unsubscribe()
    sub = liveQuery(async () => {
      const programs = await db.programs.toArray()
      const active = programs.find((p) => p.status === 'active' && !p.deleted)
      const from = active?.startDate ?? addDays(today, -1)
      const days = await db.days.where('date').aboveOrEqual(from).toArray()
      return JSON.stringify([programs.map((p) => [p.id, p.status, p.startDate, p.updatedAt]), days.map((d) => [d.date, d.updatedAt])])
    }).subscribe({ next: () => run(today), error: () => {} })
  }

  watch(dayClock.getSnapshot().today)
  const stopDay = dayClock.onNewDay((today) => watch(today))
  return () => {
    stopDay()
    sub?.unsubscribe()
  }
}
