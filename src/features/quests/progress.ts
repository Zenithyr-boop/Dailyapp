/** Pure quest logic: streaks, history, count-quest progress. No database here. */
import type { Day, Quest, QuestDef } from '../../lib/db'
import { addDays } from '../../lib/dates'
import { dayXp, isDayComplete } from '../../lib/xp'

/** Round away float noise from repeated + steps (0.1 + 0.2 …). */
export function roundAmount(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Whether a quest counts as done, given its logged value. */
export function isQuestDone(q: Pick<Quest, 'kind' | 'target' | 'value' | 'done'>): boolean {
  if (q.kind === 'count') return (q.value ?? 0) >= (q.target ?? 1)
  return q.done
}

/** A fresh, unchecked daily copy of a quest definition. */
export function freshQuest(def: QuestDef): Quest {
  const { id, title, xp, kind, target, unit, step } = def
  return kind === 'count'
    ? { id, title, xp, kind, target, unit, step, value: 0, done: false }
    : { id, title, xp, kind, done: false }
}

/**
 * Bring a day's quests in line with the current definitions: new quests are
 * added unchecked, removed ones dropped, edits applied. Progress is kept unless
 * the quest's type changed.
 */
export function mergeQuests(existing: readonly Quest[], defs: readonly QuestDef[]): Quest[] {
  const byId = new Map(existing.map((q) => [q.id, q]))
  return defs.map((def) => {
    const fresh = freshQuest(def)
    const prev = byId.get(def.id)
    if (!prev || prev.kind !== def.kind) return fresh
    const merged: Quest = def.kind === 'count' ? { ...fresh, value: prev.value ?? 0 } : { ...fresh, done: prev.done }
    return { ...merged, done: isQuestDone(merged), ...(prev.at ? { at: prev.at } : {}) }
  })
}

/** Update a count quest's value by `delta`, never below 0. */
export function addToCount(q: Quest, delta: number): Quest {
  const value = Math.max(0, roundAmount((q.value ?? 0) + delta))
  const next = { ...q, value }
  return { ...next, done: isQuestDone(next) }
}

/** Streak math lives in `lib/xp.ts` with the rest of the progression numbers. */
export { completeDateSet, computeStreak } from '../../lib/xp'

export type HistoryStatus = 'full' | 'partial' | 'missed' | 'before-start'

export interface HistoryCell {
  date: string
  status: HistoryStatus
  done: number
  total: number
  xp: number
}

/**
 * The last `count` days ending today, oldest first. Days before the user's
 * first record are `before-start`; days without a record after that are missed.
 */
export function buildHistory(
  days: readonly Day[],
  today: string,
  count = 30,
  /** The user's first-ever day; defaults to the earliest of `days`. */
  firstDate: string | undefined = days.reduce<string | undefined>((min, d) => (!min || d.date < min ? d.date : min), undefined),
): HistoryCell[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const cells: HistoryCell[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const day = byDate.get(date)
    if (!day) {
      const status = !firstDate || date < firstDate ? 'before-start' : 'missed'
      cells.push({ date, status, done: 0, total: 0, xp: 0 })
      continue
    }
    const done = day.quests.filter((q) => q.done).length
    const status = isDayComplete(day.quests) ? 'full' : done > 0 ? 'partial' : 'missed'
    cells.push({ date, status, done, total: day.quests.length, xp: dayXp(day.quests) })
  }
  return cells
}

/** Longest run of consecutive full days within the given cells. */
export function bestRun(cells: readonly HistoryCell[]): number {
  let best = 0
  let run = 0
  for (const c of cells) {
    run = c.status === 'full' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}
