import { volumeByDay, weekStart } from './week'

describe('week', () => {
  it('starts on Monday', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09') // Wednesday
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sunday
  })

  it('adds up volume per day of the week', () => {
    const v = volumeByDay(
      [
        { date: '2026-11-09', volumeKg: 1000 },
        { date: '2026-11-09', volumeKg: 500 },
        { date: '2026-11-13', volumeKg: 2000 },
        { date: '2026-11-16', volumeKg: 9999 }, // next week
      ],
      '2026-11-09',
    )
    expect(v).toEqual([1500, 0, 0, 0, 2000, 0, 0])
  })
})
