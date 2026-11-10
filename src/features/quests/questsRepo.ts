/**
 * Quests data access (local Dexie). XP, level and streak are never stored:
 * screens derive them from the days with `progressFromDays`. After each change
 * we only check for a new level or rank to celebrate.
 */
import { db, getMeta, setMeta, type Day, type Profile, type Quest, type QuestDef, type QuestFields } from '../../lib/db'
import { toDayKey } from '../../lib/dates'
import { evaluateRank, rankIndex, type Rank } from '../../lib/rank'
import { clampQuestXp, progressFromDays } from '../../lib/xp'
import { addToCount, freshQuest, mergeQuests } from './progress'

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

export function newProfile(): Profile {
  return { id: 'me', displayName: '', units: 'metric', rank: 'E', bestLevel: 1, goals: {}, updatedAt: Date.now() }
}

/** A level-up / rank-up moment waiting to be shown on this device. Never synced. */
export interface Celebration {
  level: number
  rank?: Rank
}

const CELEBRATION_KEY = 'celebration'

export function getCelebration(): Promise<Celebration | undefined> {
  return getMeta<Celebration>(CELEBRATION_KEY)
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

/** The user's quests in order, without deleted ones. */
export async function listQuestDefs(): Promise<QuestDef[]> {
  return (await db.quests.orderBy('order').toArray()).filter((q) => !q.deleted)
}

/** Make sure a record exists for `date`, starting every quest unchecked. */
export async function ensureDay(date: string = toDayKey()): Promise<void> {
  await db.transaction('rw', db.days, db.quests, async () => {
    if (await db.days.get(date)) return
    const defs = await listQuestDefs()
    await db.days.put({ date, quests: defs.map(freshQuest), updatedAt: Date.now() })
  })
  await checkMilestones(date)
}

/**
 * Raise the profile's high-water marks (best level, earned rank) when the day
 * history reaches a new level, and queue a celebration for this device.
 * Writes nothing on a normal quest tick, so it costs no sync traffic.
 * `celebrate: false` is used when the level came from another device's data.
 */
export async function checkMilestones(today: string = toDayKey(), { celebrate = true } = {}): Promise<void> {
  await db.transaction('rw', db.profile, db.days, db.meta, async () => {
    const profile = await db.profile.get('me')
    if (!profile) return
    const { level } = progressFromDays(await db.days.toArray(), today)
    const rank = evaluateRank({ level }, profile.rank)
    const rankUp = rankIndex(rank) > rankIndex(profile.rank)
    if (level <= profile.bestLevel && !rankUp) return

    if (celebrate) {
      const pending = await getCelebration()
      await setMeta(CELEBRATION_KEY, { level, rank: rankUp ? rank : pending?.rank } satisfies Celebration)
    }
    await db.profile.update('me', { bestLevel: Math.max(profile.bestLevel, level), rank })
  })
}

export async function dismissCelebration(): Promise<void> {
  await setMeta(CELEBRATION_KEY, undefined)
}

async function updateDayQuest(date: string, id: string, change: (q: Quest) => Quest): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(date)
    if (!day) return
    const quests = day.quests.map((q) => (q.id === id ? { ...change(q), at: Date.now() } : q))
    await db.days.put({ ...day, quests, updatedAt: Date.now() })
  })
  await checkMilestones()
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
  await checkMilestones(date)
}

export async function addQuest(fields: QuestFields): Promise<string> {
  const id = newId()
  const last = (await listQuestDefs()).at(-1)
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

/** Deleting leaves a tombstone so the deletion reaches the user's other devices. */
export async function deleteQuest(id: string): Promise<void> {
  await db.quests.update(id, { deleted: 1 })
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
    // Only rewrite quests whose position changed (fewer uploads).
    const changed = defs.flatMap((d, order) => (d.order === order ? [] : [{ ...d, order }]))
    await db.quests.bulkPut(changed)
  })
  await syncToday()
}
