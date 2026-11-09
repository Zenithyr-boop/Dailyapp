/**
 * Quests data access (local Dexie). Every write recomputes XP, level, rank and
 * streak so the profile always matches the day records.
 */
import { db, type Day, type Profile, type Quest, type QuestDef, type QuestFields } from '../../lib/db'
import { toDayKey } from '../../lib/dates'
import { evaluateRank, rankIndex } from '../../lib/rank'
import { clampQuestXp, dayXp, levelFromTotalXp } from '../../lib/xp'
import { addToCount, completeDateSet, computeStreak, freshQuest, mergeQuests } from './progress'

/** Starting quests for a new user. */
export const DEFAULT_QUESTS: readonly QuestFields[] = [
  { title: 'Train', xp: 120, kind: 'check' },
  { title: 'Hit protein goal', xp: 60, kind: 'check' },
  { title: 'Walk 8,000 steps', xp: 40, kind: 'check' },
  { title: 'In bed by 23:00', xp: 40, kind: 'check' },
  { title: 'Read 10 pages', xp: 30, kind: 'check' },
  { title: 'No added sugar', xp: 30, kind: 'check' },
]

function newId(): string {
  return crypto.randomUUID()
}

function newProfile(): Profile {
  return {
    id: 'me',
    displayName: '',
    units: 'metric',
    totalXp: 0,
    level: 1,
    rank: 'E',
    streak: 0,
    bestLevel: 1,
    goals: {},
    updatedAt: Date.now(),
  }
}

/** Clean up user input: trim, clamp XP, drop count fields on checkbox quests. */
export function normalizeFields(fields: QuestFields): QuestFields {
  const title = fields.title.trim() || 'Untitled quest'
  const xp = clampQuestXp(fields.xp)
  if (fields.kind === 'check') return { title, xp, kind: 'check' }
  const target = fields.target && fields.target > 0 ? fields.target : 1
  const step = fields.step && fields.step > 0 ? fields.step : 1
  return { title, xp, kind: 'count', target, unit: fields.unit?.trim() ?? '', step }
}

/** First launch: create the profile and the default quests. Safe to call often. */
export async function ensureSetup(): Promise<void> {
  await db.transaction('rw', db.profile, db.quests, async () => {
    if (await db.profile.get('me')) return
    await db.profile.put(newProfile())
    const now = Date.now()
    await db.quests.bulkPut(DEFAULT_QUESTS.map((q, i) => ({ ...q, id: newId(), order: i, updatedAt: now })))
  })
}

export async function listQuestDefs(): Promise<QuestDef[]> {
  return db.quests.orderBy('order').toArray()
}

/** Make sure a record exists for `date`, starting every quest unchecked. */
export async function ensureDay(date: string = toDayKey()): Promise<void> {
  await db.transaction('rw', db.days, db.quests, async () => {
    if (await db.days.get(date)) return
    const defs = await listQuestDefs()
    await db.days.put({ date, quests: defs.map(freshQuest), updatedAt: Date.now() })
  })
  await recomputeProgress(date)
}

/** Recalculate total XP, level, rank, streak and any pending celebration. */
export async function recomputeProgress(today: string = toDayKey()): Promise<void> {
  await db.transaction('rw', db.profile, db.days, async () => {
    const days = await db.days.toArray()
    const profile = (await db.profile.get('me')) ?? newProfile()
    const totalXp = days.reduce((sum, d) => sum + dayXp(d.quests), 0)
    const { level } = levelFromTotalXp(totalXp)
    const rank = evaluateRank({ level }, profile.rank)
    const streak = computeStreak(completeDateSet(days), today)

    let { bestLevel, celebration } = profile
    const rankUp = rankIndex(rank) > rankIndex(profile.rank)
    if (level > bestLevel || rankUp) {
      celebration = { level, rank: rankUp ? rank : celebration?.rank }
      bestLevel = Math.max(bestLevel, level)
    }
    await db.profile.put({ ...profile, totalXp, level, rank, streak, bestLevel, celebration, updatedAt: Date.now() })
  })
}

export async function dismissCelebration(): Promise<void> {
  await db.profile.update('me', { celebration: undefined })
}

async function updateDayQuest(date: string, id: string, change: (q: Quest) => Quest): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(date)
    if (!day) return
    const quests = day.quests.map((q) => (q.id === id ? change(q) : q))
    await db.days.put({ ...day, quests, updatedAt: Date.now() })
  })
  await recomputeProgress()
}

export function setQuestDone(date: string, id: string, done: boolean): Promise<void> {
  return updateDayQuest(date, id, (q) => (q.kind === 'check' ? { ...q, done } : q))
}

/** + / − on a count quest. `direction` 1 adds one step, -1 removes one. */
export function stepCount(date: string, id: string, direction: 1 | -1): Promise<void> {
  return updateDayQuest(date, id, (q) => (q.kind === 'count' ? addToCount(q, direction * (q.step ?? 1)) : q))
}

/** Apply the current quest definitions to today's record (past days stay frozen). */
async function syncToday(): Promise<void> {
  const date = toDayKey()
  await db.transaction('rw', db.days, db.quests, async () => {
    const defs = await listQuestDefs()
    const day: Day | undefined = await db.days.get(date)
    const quests = day ? mergeQuests(day.quests, defs) : defs.map(freshQuest)
    await db.days.put({ ...(day ?? { date }), quests, updatedAt: Date.now() })
  })
  await recomputeProgress(date)
}

export async function addQuest(fields: QuestFields): Promise<string> {
  const id = newId()
  const last = await db.quests.orderBy('order').last()
  await db.quests.put({ ...normalizeFields(fields), id, order: (last?.order ?? -1) + 1, updatedAt: Date.now() })
  await syncToday()
  return id
}

export async function updateQuest(id: string, fields: QuestFields): Promise<void> {
  const def = await db.quests.get(id)
  if (!def) return
  // put (not update) so fields from the old type, like `target`, are dropped.
  await db.quests.put({ id, order: def.order, ...normalizeFields(fields), updatedAt: Date.now() })
  await syncToday()
}

export async function deleteQuest(id: string): Promise<void> {
  await db.quests.delete(id)
  await syncToday()
}

/** Move a quest one place up (-1) or down (1). */
export async function moveQuest(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.quests, async () => {
    const defs = await listQuestDefs()
    const i = defs.findIndex((d) => d.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= defs.length) return
    ;[defs[i], defs[j]] = [defs[j]!, defs[i]!]
    const now = Date.now()
    await db.quests.bulkPut(defs.map((d, order) => ({ ...d, order, updatedAt: now })))
  })
  await syncToday()
}
