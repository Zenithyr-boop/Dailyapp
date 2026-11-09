import { addDays, fromDayKey, msUntilMidnight, toDayKey } from './dates'

describe('dates', () => {
  it('formats local day keys with zero padding', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('round-trips day keys', () => {
    expect(toDayKey(fromDayKey('2026-11-09'))).toBe('2026-11-09')
  })

  it('rejects malformed keys', () => {
    expect(() => fromDayKey('2026-1-9')).toThrow()
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('counts down to local midnight', () => {
    expect(msUntilMidnight(new Date(2026, 10, 9, 23, 0))).toBe(60 * 60 * 1000)
  })
})
