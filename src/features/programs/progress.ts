/**
 * Program progress, worked out from the day records (pure, unit-tested in
 * `progress.test.ts`). Nothing here is stored: the engine (`programsRepo.ts`)
 * saves what follows from it (a strict restart, the finish).
 *
 * - A program day counts when every quest tagged with the program on that
 *   day's record is done.
 * - A day is missed only once it can't be changed any more (after yesterday's
 *   grace window, see `canEditQuests`), so a miss today can still be fixed tomorrow.
 * - Strict: a missed day ends the attempt; the next one starts the day after it.
 * - Not strict: missed days are marked and the program goes on.
 */
import { addDays, canEditQuests, daysBetween } from '../../lib/day'
import type { Day, ProgramAttempt, ProgramState } from '../../lib/db'

/**
 * done: every rule done. missed: closed without them. open: yesterday, not done
 * yet but still open. today / future: still to come.
 */
export type ProgramDayStatus = 'done' | 'missed' | 'open' | 'today' | 'future'

export interface ProgramDay {
  date: string
  /** Day number, 1-based. */
  n: number
  status: ProgramDayStatus
}

export interface ProgramProgress {
  /** Day 1 of the current attempt (later than the stored one after a restart). */
  startDate: string
  /** Strict restarts found that aren't in `program.attempts` yet. */
  newAttempts: ProgramAttempt[]
  /** Every day of the current attempt. */
  days: ProgramDay[]
  /** Today's day number in the current attempt (capped at the length). */
  dayNumber: number
  daysDone: number
  missed: number
  /** Last day of the current attempt. */
  lastDate: string
  /** Every day done (strict), or every day done or closed (not strict). */
  finished: boolean
}

/** Whether a day holds every one of the program's rules, all done. */
export function programDayDone(day: Day | undefined, programId: string): boolean {
  if (!day || day.deleted) return false
  const rules = day.quests.filter((q) => q.programId === programId)
  return rules.length > 0 && rules.every((q) => q.done)
}

type ProgramLike = Pick<ProgramState, 'id' | 'length' | 'strict' | 'startDate'>

function statusOf(date: string, today: string, done: boolean): ProgramDayStatus {
  if (date > today) return 'future'
  if (done) return 'done'
  if (date === today) return 'today'
  return canEditQuests(date, today) ? 'open' : 'missed'
}

export function evaluateProgram(program: ProgramLike, dayOf: (date: string) => Day | undefined, today: string): ProgramProgress {
  const newAttempts: ProgramAttempt[] = []
  let start = program.startDate

  /** The days of the attempt starting at `start`, or undefined after a strict restart (`start` moved on). */
  const walk = (): ProgramDay[] | undefined => {
    const out: ProgramDay[] = []
    for (let i = 0; i < program.length; i++) {
      const date = addDays(start, i)
      const status = statusOf(date, today, programDayDone(dayOf(date), program.id))
      if (program.strict && status === 'missed') {
        newAttempts.push({ startDate: start, endDate: date, daysDone: i, end: 'missed' })
        start = addDays(date, 1)
        return undefined
      }
      out.push({ date, n: i + 1, status })
    }
    return out
  }
  // Ends: a miss needs a closed day, and each restart moves past one.
  let days = walk()
  while (!days) days = walk()

  const daysDone = days.filter((d) => d.status === 'done').length
  const missed = days.filter((d) => d.status === 'missed').length
  const finished = program.strict ? daysDone === program.length : daysDone + missed === program.length
  const dayNumber = Math.min(program.length, Math.max(1, daysBetween(start, today) + 1))
  return { startDate: start, newAttempts, days, dayNumber, daysDone, missed, lastDate: addDays(start, program.length - 1), finished }
}

/** Grid columns that keep the squares roughly in a block (66 → 11, 75 → 15). */
export function gridColumns(length: number): number {
  if (length <= 10) return length
  for (const cols of [11, 15, 10, 12, 14, 7]) if (length % cols === 0 && length / cols >= 3) return cols
  return Math.min(15, Math.ceil(Math.sqrt(length * 2)))
}
