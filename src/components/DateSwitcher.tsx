import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { addDays, dayLabel, monthOf } from '../lib/day'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import { MonthCalendar, type DayInfo } from './MonthCalendar'

interface DateSwitcherProps {
  /** The day shown (already clamped to today or earlier). */
  date: string
  today: string
  /** Optional marks for the picker (e.g. quest results). */
  dayInfo?: (date: string) => DayInfo | undefined
  /** Other search params to drop when the day changes (e.g. an open entry). */
  clear?: readonly string[]
}

/**
 * The shared "‹ Today ›" control with a month picker. The day lives in the URL
 * (`?date=`, absent = today) and so does the open picker (`?pick=1`), so the
 * phone's Back button closes it. No future days.
 */
export function DateSwitcher({ date, today, dayInfo, clear = [] }: DateSwitcherProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const picking = params.get('pick') === '1'
  const [month, setMonth] = useState(() => monthOf(date))

  function searchFor(next: string | undefined, pick: boolean) {
    const p = new URLSearchParams(params)
    for (const k of clear) p.delete(k)
    if (next !== undefined) {
      if (next === today) p.delete('date')
      else p.set('date', next)
    }
    if (pick) p.set('pick', '1')
    else p.delete('pick')
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  const goTo = (next: string) => setParams(new URLSearchParams(searchFor(next, false)), { preventScrollReset: true })
  const pushedPicker = !!(location.state as { picker?: boolean } | null)?.picker

  function openPicker() {
    setMonth(monthOf(date))
    navigate({ search: searchFor(undefined, true) }, { state: { picker: true }, preventScrollReset: true })
  }

  function closePicker() {
    if (pushedPicker) navigate(-1)
    else navigate({ search: searchFor(undefined, false) }, { replace: true, preventScrollReset: true })
  }

  /** Picking replaces the picker's history entry, so Back returns to the day before the pick. */
  function pick(next: string) {
    navigate({ search: searchFor(next, false) }, { replace: true, preventScrollReset: true })
  }

  const label = dayLabel(date, today)
  const btn = 'grid size-touch place-items-center text-muted hover:text-accent disabled:opacity-40 disabled:hover:text-muted'

  return (
    <>
      <nav aria-label="Day" className="flex items-center border border-line">
        <button type="button" aria-label="Previous day" title="Previous day" onClick={() => goTo(addDays(date, -1))} className={btn}>
          <ChevronLeftIcon size={20} />
        </button>
        <button
          type="button"
          onClick={() => goTo(today)}
          disabled={date === today}
          className="min-h-touch min-w-24 px-2 font-display text-sm font-bold uppercase tracking-wider disabled:cursor-default"
          aria-label={date === today ? 'Showing today' : `Showing ${label}. Go to today`}
        >
          {label}
        </button>
        <button
          type="button"
          aria-label="Next day"
          title="Next day"
          onClick={() => goTo(addDays(date, 1))}
          disabled={date >= today}
          className={btn}
        >
          <ChevronRightIcon size={20} />
        </button>
        <button type="button" aria-label="Pick a day" title="Pick a day" onClick={openPicker} className={`${btn} border-l border-line`}>
          <CalendarIcon size={20} />
        </button>
      </nav>
      {picking && (
        <Dialog title="Pick a day" onClose={closePicker}>
          <MonthCalendar month={month} today={today} selected={date} onMonthChange={setMonth} onPick={pick} dayInfo={dayInfo} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => pick(today)}>
              Today
            </Button>
            <Button variant="secondary" className="flex-1" onClick={closePicker}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
