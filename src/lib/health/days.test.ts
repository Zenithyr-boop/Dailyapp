import { combineDays, planHealthWrites, rememberImported, sleepByDay, stepsByDay, weightByDay } from './days'

// Local times (the test runner's time zone), as Health Connect would report them in ISO.
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00`).toISOString()

describe('stepsByDay', () => {
  it('sums hourly buckets per day', () => {
    const buckets = [
      { startDate: at('2026-11-10', '08:00'), value: 1200 },
      { startDate: at('2026-11-10', '18:00'), value: 3000.4 },
      { startDate: at('2026-11-11', '09:00'), value: 500 },
      { startDate: at('2026-11-11', '10:00'), value: 0 },
    ]
    expect(stepsByDay(buckets, 0)).toEqual({ '2026-11-10': 4200, '2026-11-11': 500 })
  })

  it('counts hours before the day start toward the day before', () => {
    const buckets = [
      { startDate: at('2026-11-11', '01:00'), value: 800 },
      { startDate: at('2026-11-11', '04:00'), value: 100 },
    ]
    expect(stepsByDay(buckets, 4)).toEqual({ '2026-11-10': 800, '2026-11-11': 100 })
    expect(stepsByDay(buckets, 0)).toEqual({ '2026-11-11': 900 })
  })
})

describe('sleepByDay', () => {
  it('puts a night on the day you wake up, counting only asleep stages', () => {
    const night = {
      startDate: at('2026-11-10', '23:00'),
      endDate: at('2026-11-11', '07:00'),
      stages: [
        { startDate: at('2026-11-10', '23:00'), endDate: at('2026-11-10', '23:30'), stage: 'awake' },
        { startDate: at('2026-11-10', '23:30'), endDate: at('2026-11-11', '03:00'), stage: 'light' },
        { startDate: at('2026-11-11', '03:00'), endDate: at('2026-11-11', '04:00'), stage: 'deep' },
        { startDate: at('2026-11-11', '04:00'), endDate: at('2026-11-11', '04:15'), stage: 'awake' },
        { startDate: at('2026-11-11', '04:15'), endDate: at('2026-11-11', '07:00'), stage: 'rem' },
      ],
    }
    // 3.5 h + 1 h + 2.75 h = 435 min
    expect(sleepByDay([night], 0)).toEqual({ '2026-11-11': 435 })
  })

  it('uses the whole session without stages, adds naps and counts overlaps once', () => {
    const sessions = [
      { startDate: at('2026-11-10', '23:00'), endDate: at('2026-11-11', '06:00') },
      // A second tracker recording the same night, a bit longer.
      { startDate: at('2026-11-11', '00:00'), endDate: at('2026-11-11', '06:30') },
      // Afternoon nap.
      { startDate: at('2026-11-11', '14:00'), endDate: at('2026-11-11', '14:30') },
    ]
    expect(sleepByDay(sessions, 0)).toEqual({ '2026-11-11': 7.5 * 60 + 30 })
  })

  it('follows the day start for a late wake-up time', () => {
    const late = { startDate: at('2026-11-10', '20:00'), endDate: at('2026-11-11', '02:00') }
    expect(sleepByDay([late], 4)).toEqual({ '2026-11-10': 360 })
  })
})

describe('weightByDay', () => {
  it('keeps the last weigh-in of each day, to 3 decimals', () => {
    const samples = [
      { startDate: at('2026-11-10', '07:00'), value: 80.1234 },
      { startDate: at('2026-11-10', '21:00'), value: 80.9 },
      { startDate: at('2026-11-11', '07:00'), value: 79.8 },
    ]
    expect(weightByDay(samples, 0)).toEqual({ '2026-11-10': 80.9, '2026-11-11': 79.8 })
  })
})

describe('planHealthWrites', () => {
  const read = combineDays({
    steps: { '2026-11-10': 9000, '2026-11-11': 4000 },
    sleepMinutes: { '2026-11-11': 420 },
    weightKg: { '2026-11-11': 80 },
  })

  it('writes everything the first time, oldest day first, never a future day', () => {
    const future = { ...read, '2026-11-12': { steps: 10 } }
    expect(planHealthWrites(future, {}, '2026-11-11')).toEqual([
      { date: '2026-11-10', values: { steps: 9000 } },
      { date: '2026-11-11', values: { steps: 4000, sleepMinutes: 420, weightKg: 80 } },
    ])
  })

  it('skips values Health Connect still reports unchanged, so hand edits stay', () => {
    const imported = { '2026-11-10': { steps: 9000 }, '2026-11-11': { steps: 3500, sleepMinutes: 420, weightKg: 80 } }
    expect(planHealthWrites(read, imported, '2026-11-11')).toEqual([{ date: '2026-11-11', values: { steps: 4000 } }])
  })

  it('remembers what was written and forgets old days', () => {
    const imported = { '2026-10-01': { steps: 1 }, '2026-11-10': { steps: 9000 } }
    const writes = [{ date: '2026-11-11', values: { steps: 4000 } }]
    expect(rememberImported(imported, writes, '2026-10-13')).toEqual({
      '2026-11-10': { steps: 9000 },
      '2026-11-11': { steps: 4000 },
    })
  })
})
