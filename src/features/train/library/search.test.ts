import data from './exercises.json'
import { toMovement } from './catalog'
import { COACH_PICKS } from './coachPicks'
import { editDistance, indexMovement, NO_FILTERS, normalize, searchMovements, stem, type MovementFilters } from './search'
import type { LibraryEntry, Movement } from './types'

const library = (data as LibraryEntry[]).map(toMovement)
const index = library.map(indexMovement)

function search(query: string, filters: MovementFilters = NO_FILTERS, picks: readonly string[] = COACH_PICKS) {
  return searchMovements(index, query, filters, picks)
}
const top = (query: string, n = 1) => search(query).slice(0, n).map((m) => m.id)

describe('text helpers', () => {
  it('normalizes punctuation and case', () => {
    expect(normalize('Barbell Bench Press - Medium Grip')).toBe('barbell bench press medium grip')
    expect(normalize('3/4 Sit-Up')).toBe('3 4 sit up')
  })

  it('stems plurals without breaking "press"', () => {
    expect(stem('curls')).toBe('curl')
    expect(stem('crunches')).toBe('crunch')
    expect(stem('press')).toBe('press')
    expect(stem('abs')).toBe('abs')
  })

  it('counts a swapped pair of letters as one typo', () => {
    expect(editDistance('benhc', 'bench')).toBe(1)
    expect(editDistance('dedlift', 'deadlift')).toBe(1)
    expect(editDistance('squat', 'squat')).toBe(0)
  })
})

describe('searchMovements', () => {
  it('finds movements despite typos', () => {
    expect(top('benhc pres')).toEqual(['Barbell_Bench_Press_-_Medium_Grip'])
    expect(top('dedlift')).toEqual(['Barbell_Deadlift'])
    expect(top('squaat')).toEqual(['Barbell_Squat'])
    expect(top('latteral raize')).toEqual(['Side_Lateral_Raise'])
  })

  it('matches partial words and any word order', () => {
    expect(top('lat pull')).toEqual(['Wide-Grip_Lat_Pulldown'])
    expect(top('press bench dumbbell')).toEqual(['Dumbbell_Bench_Press'])
  })

  it('understands common abbreviations and other names', () => {
    expect(top('rdl')).toEqual(['Romanian_Deadlift'])
    expect(top('ohp')).toEqual(['Standing_Military_Press'])
    expect(top('db row')).toEqual(['One-Arm_Dumbbell_Row'])
    expect(top('pec deck')).toEqual(['Butterfly'])
    expect(top('pushup')).toEqual(['Pushups'])
    expect(top('push up')).toEqual(['Pushups'])
  })

  it('ranks coach picks above other matches', () => {
    const results = search('curl')
    const firstNonPick = results.findIndex((m) => !COACH_PICKS.includes(m.id))
    const picksFound = results.filter((m) => COACH_PICKS.includes(m.id))
    expect(picksFound.length).toBeGreaterThan(3)
    expect(results.slice(0, firstNonPick).every((m) => COACH_PICKS.includes(m.id))).toBe(true)
  })

  it('lists picks first, in the coach’s order, when there is no query', () => {
    const results = search('')
    expect(results).toHaveLength(library.length)
    expect(results.slice(0, COACH_PICKS.length).map((m) => m.id)).toEqual([...COACH_PICKS])
  })

  it('returns nothing for gibberish', () => {
    expect(search('zzqxv')).toEqual([])
  })

  it('applies filters: any value within a group, every group must match', () => {
    const filters: MovementFilters = {
      muscles: new Set(['chest']),
      equipment: new Set(['dumbbell', 'cable']),
      categories: new Set(),
    }
    const results = search('', filters)
    expect(results.length).toBeGreaterThan(10)
    expect(results.every((m) => m.primaryMuscles.includes('chest'))).toBe(true)
    expect(results.every((m) => m.equipment === 'dumbbell' || m.equipment === 'cable')).toBe(true)
    expect(results[0]?.id).toBe('Dumbbell_Bench_Press')
  })

  it('ranks custom movements after picks and before the rest', () => {
    const custom: Movement = {
      id: 'custom-1',
      name: 'Landmine Press',
      primaryMuscles: ['shoulders'],
      secondaryMuscles: [],
      equipment: 'barbell',
      category: 'strength',
      instructions: [],
      images: 0,
      tracking: 'weight_reps',
      source: 'custom',
    }
    const results = searchMovements([...index, indexMovement(custom)], 'press', NO_FILTERS, COACH_PICKS)
    const at = results.findIndex((m) => m.id === 'custom-1')
    expect(at).toBeGreaterThan(0)
    expect(results.slice(0, at).every((m) => COACH_PICKS.includes(m.id))).toBe(true)
  })
})
