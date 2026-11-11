import {
  addDays,
  calendarKey,
  canEditQuests,
  clampDay,
  createDayClock,
  dayKeyAt,
  daysBetween,
  dayStartTime,
  formatCountdown,
  fromDayKey,
  msUntilNextDay,
  normalizeDayStart,
} from './day'

// Daylight-saving dates below are New York's (2026: spring forward 8 Mar 02:00, fall back 1 Nov 02:00).
beforeAll(() => {
  vi.stubEnv('TZ', 'America/New_York')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s)
const HOUR = 3_600_000

describe('day keys', () => {
  it('formats local calendar keys with zero padding', () => {
    expect(calendarKey(at(2026, 1, 5, 23, 59))).toBe('2026-01-05')
  })

  it('round-trips and rejects malformed keys', () => {
    expect(calendarKey(fromDayKey('2026-11-09'))).toBe('2026-11-09')
    expect(() => fromDayKey('2026-1-9')).toThrow()
  })

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
    expect(daysBetween('2026-11-09', '2026-11-06')).toBe(-3)
  })

  it('uses midnight by default', () => {
    expect(dayKeyAt(at(2026, 11, 10, 23, 59, 59))).toBe('2026-11-10')
    expect(dayKeyAt(at(2026, 11, 11, 0, 0, 0))).toBe('2026-11-11')
  })

  it('counts time before a 4 AM day start toward the previous day', () => {
    expect(dayKeyAt(at(2026, 11, 11, 0, 30), 4)).toBe('2026-11-10')
    expect(dayKeyAt(at(2026, 11, 11, 3, 59, 59), 4)).toBe('2026-11-10')
    expect(dayKeyAt(at(2026, 11, 11, 4, 0), 4)).toBe('2026-11-11')
    // New Year: 01:00 on 1 Jan is still 31 Dec.
    expect(dayKeyAt(at(2027, 1, 1, 1, 0), 4)).toBe('2026-12-31')
  })

  it('only accepts day-start hours 0–4', () => {
    expect(normalizeDayStart(3)).toBe(3)
    expect(normalizeDayStart(5)).toBe(0)
    expect(normalizeDayStart(undefined)).toBe(0)
    expect(normalizeDayStart('2')).toBe(0)
  })
})

describe('countdown', () => {
  it('measures to the next midnight', () => {
    expect(msUntilNextDay(at(2026, 11, 9, 23, 0))).toBe(HOUR)
    expect(msUntilNextDay(at(2026, 11, 9, 14, 18))).toBe(9 * HOUR + 42 * 60_000)
  })

  it('measures to the next 4 AM, from both sides of midnight', () => {
    expect(msUntilNextDay(at(2026, 11, 9, 23, 0), 4)).toBe(5 * HOUR)
    expect(msUntilNextDay(at(2026, 11, 10, 1, 0), 4)).toBe(3 * HOUR)
    expect(msUntilNextDay(at(2026, 11, 10, 4, 0), 4)).toBe(24 * HOUR)
  })

  it('handles the short spring-forward night (23 hours)', () => {
    expect(msUntilNextDay(at(2026, 3, 7, 23, 0))).toBe(HOUR)
    // 00:00 → 04:00 on 8 March is only 3 real hours: 02:00–03:00 doesn't exist.
    expect(msUntilNextDay(at(2026, 3, 8, 0, 0), 4)).toBe(3 * HOUR)
    expect(dayStartTime('2026-03-09') - dayStartTime('2026-03-08')).toBe(23 * HOUR)
    expect(dayStartTime('2026-03-08') - dayStartTime('2026-03-07')).toBe(24 * HOUR)
  })

  it('handles the long fall-back night (25 hours)', () => {
    // 00:00 → 04:00 on 1 November is 5 real hours: 01:00–02:00 happens twice.
    expect(msUntilNextDay(at(2026, 11, 1, 0, 0), 4)).toBe(5 * HOUR)
    expect(dayStartTime('2026-11-02') - dayStartTime('2026-11-01')).toBe(25 * HOUR)
    // Both 01:30s belong to 31 October with a 4 AM start.
    const firstOneThirty = at(2026, 11, 1, 1, 30).getTime()
    expect(dayKeyAt(firstOneThirty, 4)).toBe('2026-10-31')
    expect(dayKeyAt(firstOneThirty + HOUR, 4)).toBe('2026-10-31')
  })

  it('formats whole hours and minutes left, rounding down', () => {
    expect(formatCountdown(9 * HOUR + 42 * 60_000)).toBe('9h 42m')
    expect(formatCountdown(9 * HOUR + 42 * 60_000 + 59_999)).toBe('9h 42m')
    expect(formatCountdown(42 * 60_000)).toBe('42m')
    expect(formatCountdown(59_000)).toBe('<1m')
    expect(formatCountdown(0)).toBe('<1m')
    expect(formatCountdown(HOUR)).toBe('1h 0m')
  })
})

describe('rules', () => {
  it('allows quest changes today and yesterday only', () => {
    expect(canEditQuests('2026-11-10', '2026-11-10')).toBe(true)
    expect(canEditQuests('2026-11-09', '2026-11-10')).toBe(true)
    expect(canEditQuests('2026-11-08', '2026-11-10')).toBe(false)
    expect(canEditQuests('2026-11-11', '2026-11-10')).toBe(false)
  })

  it('never shows a future or malformed day', () => {
    expect(clampDay('2026-11-11', '2026-11-10')).toBe('2026-11-10')
    expect(clampDay('2026-11-01', '2026-11-10')).toBe('2026-11-01')
    expect(clampDay('yesterday', '2026-11-10')).toBe('2026-11-10')
    expect(clampDay(null, '2026-11-10')).toBe('2026-11-10')
  })
})

describe('day clock (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function startClock(time: Date, startHour?: 0 | 1 | 2 | 3 | 4) {
    vi.setSystemTime(time)
    const onNewDay = vi.fn()
    const clock = createDayClock({ onNewDay, startHour })
    clock.start({ watchProfile: false })
    return { clock, onNewDay }
  }

  it('rolls over at midnight while the app is open', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 10, 23, 59, 30))
    expect(clock.getSnapshot().today).toBe('2026-11-10')
    vi.advanceTimersByTime(29_000)
    expect(clock.getSnapshot().today).toBe('2026-11-10')
    vi.advanceTimersByTime(2_000)
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    expect(onNewDay).toHaveBeenCalledOnce()
    expect(onNewDay).toHaveBeenCalledWith('2026-11-11', '2026-11-10')
    clock.stop()
  })

  it('updates the countdown every minute', () => {
    const { clock } = startClock(at(2026, 11, 10, 14, 18, 0))
    const listener = vi.fn()
    clock.subscribe(listener)
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('9h 42m')
    // Checks land just after each minute boundary.
    vi.advanceTimersByTime(60_100)
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('9h 40m')
    vi.advanceTimersByTime(60_000 * 5)
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('9h 35m')
    expect(listener).toHaveBeenCalledTimes(6)
    clock.stop()
  })

  it('with a 4 AM start, stays on the previous day past midnight and rolls at 04:00', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 10, 23, 30), 4)
    vi.advanceTimersByTime(HOUR + 100) // just after 00:30 on the 11th
    expect(clock.getSnapshot().today).toBe('2026-11-10')
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('3h 29m')
    expect(onNewDay).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3.5 * HOUR + 1_000) // 04:00:01
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    expect(onNewDay).toHaveBeenCalledOnce()
    clock.stop()
  })

  it('rolls over correctly on a daylight-saving night', () => {
    // Fall back: 4 AM comes 5 real hours after midnight.
    const { clock, onNewDay } = startClock(at(2026, 10, 31, 23, 59), 4)
    vi.advanceTimersByTime(4 * HOUR + 2 * 60_000) // 02:01 wall time (after the repeat hour), still the 31st
    expect(clock.getSnapshot().today).toBe('2026-10-31')
    vi.advanceTimersByTime(2 * HOUR) // past 04:00 wall time
    expect(clock.getSnapshot().today).toBe('2026-11-01')
    expect(onNewDay).toHaveBeenCalledOnce()
    clock.stop()
  })

  it('ends the 23-hour spring-forward day at the next midnight', () => {
    const { clock, onNewDay } = startClock(at(2026, 3, 7, 23, 59, 30))
    vi.advanceTimersByTime(31_000)
    expect(clock.getSnapshot().today).toBe('2026-03-08')
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('22h 59m')
    vi.advanceTimersByTime(22 * HOUR + 58 * 60_000) // 23:58 wall time on the 8th
    expect(clock.getSnapshot().today).toBe('2026-03-08')
    vi.advanceTimersByTime(2 * 60_000)
    expect(clock.getSnapshot().today).toBe('2026-03-09')
    expect(onNewDay).toHaveBeenCalledTimes(2)
    clock.stop()
  })

  it('catches up when a phone wakes after sleeping across midnight', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 10, 23, 50))
    // Asleep: timers don't run, but the wall clock moves on to 07:10.
    vi.setSystemTime(at(2026, 11, 11, 7, 10))
    expect(clock.getSnapshot().today).toBe('2026-11-10') // nothing has checked yet
    document.dispatchEvent(new Event('visibilitychange'))
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    expect(formatCountdown(clock.getSnapshot().msLeft)).toBe('16h 50m')
    expect(onNewDay).toHaveBeenCalledOnce()
    clock.stop()
  })

  it('also catches up on focus and pageshow', () => {
    const { clock } = startClock(at(2026, 11, 10, 23, 50))
    vi.setSystemTime(at(2026, 11, 11, 8, 0))
    window.dispatchEvent(new Event('focus'))
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    vi.setSystemTime(at(2026, 11, 12, 8, 0))
    window.dispatchEvent(new Event('pageshow'))
    expect(clock.getSnapshot().today).toBe('2026-11-12')
    clock.stop()
  })

  it('recovers when a timer fires just before midnight (the old bug)', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 10, 23, 59, 0))
    // The wall clock is nudged back (NTP), so the next tick lands at 23:59:59.
    vi.setSystemTime(at(2026, 11, 10, 23, 58, 59))
    vi.advanceTimersByTime(61_000)
    expect(clock.getSnapshot().today).toBe('2026-11-10')
    // The clock rescheduled itself, so the next minute catches midnight without any event.
    vi.advanceTimersByTime(60_000)
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    expect(onNewDay).toHaveBeenCalledOnce()
    clock.stop()
  })

  it('reports every skipped day as one change after days away', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 6, 21, 0))
    vi.setSystemTime(at(2026, 11, 9, 9, 0))
    window.dispatchEvent(new Event('focus'))
    expect(clock.getSnapshot().today).toBe('2026-11-09')
    expect(onNewDay).toHaveBeenCalledWith('2026-11-09', '2026-11-06')
    clock.stop()
  })

  it('moves "today" when the day-start setting changes', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 11, 1, 0))
    expect(clock.getSnapshot().today).toBe('2026-11-11')
    clock.setStartHour(4)
    expect(clock.getSnapshot().today).toBe('2026-11-10')
    expect(clock.getSnapshot().startHour).toBe(4)
    expect(onNewDay).toHaveBeenCalledWith('2026-11-10', '2026-11-11')
    clock.stop()
  })

  it('stops listening when stopped', () => {
    const { clock, onNewDay } = startClock(at(2026, 11, 10, 23, 59, 30))
    clock.stop()
    vi.advanceTimersByTime(HOUR)
    window.dispatchEvent(new Event('focus'))
    expect(onNewDay).not.toHaveBeenCalled()
  })
})
