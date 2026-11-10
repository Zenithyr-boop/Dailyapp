import data from './exercises.json'
import { CATEGORIES, EQUIPMENT, imageUrl, MUSCLES } from './catalog'
import { COACH_PICKS } from './coachPicks'
import { guessTracking } from './guessTracking'
import { TRACKING } from './trackingTypes'
import { TRACKING_TYPES, type LibraryEntry } from './types'

const library = data as LibraryEntry[]
const ids = new Set(library.map((e) => e.id))

describe('bundled library', () => {
  it('has the whole dataset with unique ids', () => {
    expect(library.length).toBeGreaterThan(800)
    expect(ids.size).toBe(library.length)
  })

  it('only uses known muscles, equipment and categories (so every filter chip works)', () => {
    for (const e of library) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES).toContain(m)
      expect(EQUIPMENT).toContain(e.equipment)
      expect(CATEGORIES).toContain(e.category)
    }
  })

  it('builds photo URLs from the pinned dataset commit', () => {
    expect(imageUrl('Plank', 0)).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/[0-9a-f]{40}\/exercises\/Plank\/0\.jpg$/)
  })
})

describe("coach's picks", () => {
  it('are real movement ids, listed once', () => {
    expect(COACH_PICKS.filter((id) => !ids.has(id))).toEqual([])
    expect(new Set(COACH_PICKS).size).toBe(COACH_PICKS.length)
  })
})

describe('tracking types', () => {
  it('cover every movement with a valid type', () => {
    for (const e of library) expect(TRACKING_TYPES).toContain(TRACKING[e.id])
    expect(Object.keys(TRACKING).filter((id) => !ids.has(id))).toEqual([])
  })

  it.each([
    ['Barbell_Bench_Press_-_Medium_Grip', 'weight_reps'],
    ['Pullups', 'bodyweight_reps'],
    ['Parallel_Bar_Dip', 'bodyweight_reps'],
    ['Band_Assisted_Pull-Up', 'assisted'],
    ['Plank', 'time'],
    ['Side_Bridge', 'time'],
    ['Running_Treadmill', 'distance_time'],
    ['Rowing_Stationary', 'distance_time'],
    ['Weighted_Pull_Ups', 'weight_reps'],
  ])('guess %s → %s', (id, type) => {
    expect(TRACKING[id]).toBe(type)
  })

  it('guesses from the raw fields', () => {
    expect(guessTracking({ id: 'x', name: 'Assisted Dip Machine', category: 'strength', equipment: 'machine' })).toBe('assisted')
    expect(guessTracking({ id: 'x', name: 'Wall Sit', category: 'strength', equipment: 'body only' })).toBe('time')
    expect(guessTracking({ id: 'x', name: 'Hamstring Stretch', category: 'stretching', equipment: null })).toBe('time')
    expect(guessTracking({ id: 'x', name: 'Sled Push', category: 'strongman', equipment: 'other' })).toBe('distance_time')
  })
})
