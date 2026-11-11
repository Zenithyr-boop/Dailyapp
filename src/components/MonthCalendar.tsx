import { daysOfMonth, fromDayKey, monthOf, addMonths } from '../lib/day'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/** How a day did on its quests (history colours). */
export type DayMark = 'full' | 'partial' | 'missed'

export interface DayInfo {
  mark?: DayMark
  /** Short text under the day number, e.g. "4/6". */
  note?: string
  /** Screen-reader description, e.g. "4 of 6 quests". */
  label?: string
}

interface MonthCalendarProps {
  /** `YYYY-MM`. */
  month: string
  today: string
  selected?: string
  onMonthChange: (month: string) => void
  onPick: (date: string) => void
  dayInfo?: (date: string) => DayInfo | undefined
}

const MARK: Record<DayMark, string> = {
  full: 'bg-accent text-on-accent',
  partial: 'bg-accent/35',
  missed: 'bg-line',
}

const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
// Weeks start on Monday. 2024-01-01 was a Monday.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i))

/**
 * A month grid of day buttons (weeks start Monday). Future days can't be
 * picked and the next-month arrow stops at the current month.
 */
export function MonthCalendar({ month, today, selected, onMonthChange, onPick, dayInfo }: MonthCalendarProps) {
  const days = daysOfMonth(month)
  const lead = (fromDayKey(days[0]!).getDay() + 6) % 7 // blanks before the 1st
  const atCurrentMonth = month >= monthOf(today)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="grid size-touch place-items-center border border-line text-muted hover:border-accent hover:text-accent"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <p className="font-display text-xl font-bold uppercase tracking-wider" aria-live="polite">
          {monthTitle.format(fromDayKey(`${month}-01`))}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={atCurrentMonth}
          className="grid size-touch place-items-center border border-line text-muted hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
        >
          <ChevronRightIcon size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label={monthTitle.format(fromDayKey(`${month}-01`))}>
        {WEEK.map((d) => (
          <abbr key={d.getDay()} title={weekdayLong.format(d)} className="label pb-1 text-center no-underline">
            {weekday.format(d)}
          </abbr>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((date) => {
          const future = date > today
          const info = future ? undefined : dayInfo?.(date)
          const isToday = date === today
          const isSelected = date === selected
          const label = [fullDate.format(fromDayKey(date)), isToday ? 'today' : '', info?.label ?? ''].filter(Boolean).join(', ')
          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => onPick(date)}
              aria-label={label}
              aria-current={isSelected ? 'date' : undefined}
              className={`flex min-h-touch flex-col items-center justify-center tabular-nums hover:outline-1 hover:outline-accent disabled:text-faint disabled:hover:outline-0 ${
                info?.mark ? MARK[info.mark] : ''
              } ${isSelected ? 'outline-2 outline-text' : isToday ? 'outline-2 outline-muted' : ''}`}
            >
              <span className="font-display text-base font-bold leading-none">{Number(date.slice(8))}</span>
              {info?.note && <span className="mt-0.5 text-[11px] leading-none">{info.note}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
