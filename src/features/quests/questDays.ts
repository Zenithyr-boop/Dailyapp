import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { DayInfo } from '../../components/MonthCalendar'
import { db, type Day } from '../../lib/db'
import { firstQuestDate, historyCell, type HistoryCell } from './progress'

/** Calendar marks for a history cell (nothing before the user's first day; today has no mark until it's full). */
export function cellInfo(c: HistoryCell, today: string): DayInfo | undefined {
  if (c.status === 'before-start') return undefined
  if (c.date >= today && c.status !== 'full') {
    return c.total ? { note: `${c.done}/${c.total}`, label: `in progress, ${c.done} of ${c.total} quests done` } : undefined
  }
  if (c.total === 0) return { mark: 'missed', label: 'missed' }
  return { mark: c.status, note: `${c.done}/${c.total}`, label: `${c.done} of ${c.total} quests done` }
}

export interface QuestDays {
  /** Every live day, oldest first. */
  days: Day[]
  byDate: Map<string, Day>
  firstDate: string | undefined
  cell: (date: string) => HistoryCell
  info: (date: string) => DayInfo | undefined
}

/** All day records (live), with lookups for calendars. Undefined while loading. */
export function useQuestDays(today: string): QuestDays | undefined {
  const all = useLiveQuery(() => db.days.orderBy('date').toArray(), [])
  return useMemo(() => {
    if (!all) return undefined
    const days = all.filter((d) => !d.deleted)
    const byDate = new Map(days.map((d) => [d.date, d]))
    const firstDate = firstQuestDate(days)
    const cell = (date: string) => historyCell(date, byDate.get(date), firstDate)
    return { days, byDate, firstDate, cell, info: (date: string) => cellInfo(cell(date), today) }
  }, [all, today])
}
