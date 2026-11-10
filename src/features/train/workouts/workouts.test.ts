import type { WorkoutItem } from '../../../lib/db'
import { TRACKING } from '../library/trackingTypes'
import exercises from '../library/exercises.json'
import { estimateSeconds, formatDuration, workSeconds } from './duration'
import { STARTER_PROGRAMS, STARTERS } from './starters'
import {
  effectiveRest,
  linkedToNext,
  linkWithNext,
  moveItem,
  normalizeGroups,
  removeItem,
  supersetLabels,
  unlinkFromNext,
} from './supersets'
import { fitTarget, formatSeconds, formatTarget, newItem, targetKind } from './targets'

const item = (key: string, extra: Partial<WorkoutItem> = {}): WorkoutItem => ({
  key,
  movementId: key,
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  restSec: 90,
  ...extra,
})
const keys = (items: WorkoutItem[]) => items.map((i) => i.key).join('')
const groups = (items: WorkoutItem[]) => items.map((i) => i.group ?? '-').join('')

describe('targets', () => {
  it('starts each tracking type with a target that fits it', () => {
    expect(newItem('x', 'weight_reps', 'k')).toMatchObject({ sets: 3, repsMin: 8, repsMax: 12 })
    expect(newItem('x', 'time', 'k')).toMatchObject({ sets: 3, seconds: 30 })
    expect(newItem('x', 'time', 'k').repsMin).toBeUndefined()
    expect(newItem('x', 'distance_time', 'k')).toMatchObject({ sets: 1, seconds: 600 })
  })

  it('keeps only the fields that fit the tracking type and clamps values', () => {
    const messy = item('a', { sets: 40, repsMin: 12, repsMax: 6, seconds: 30, rpe: 8.3, restSec: -5, note: '  slow  ' })
    expect(fitTarget(messy, 'weight_reps')).toEqual({
      key: 'a',
      movementId: 'a',
      sets: 10,
      repsMin: 6,
      repsMax: 12,
      rpe: 8.5,
      restSec: 0,
      note: 'slow',
    })
    const timed = fitTarget(messy, 'time')
    expect(timed.repsMin).toBeUndefined()
    expect(timed.seconds).toBe(30)
    expect(fitTarget(item('b'), 'time').seconds).toBe(30) // missing → default
    expect(fitTarget(item('c', { meters: 2000, seconds: 600 }), 'distance_time')).toMatchObject({ seconds: 600, meters: 2000 })
  })

  it('formats targets for each kind', () => {
    expect(formatTarget(item('a', { repsMin: 6, repsMax: 8 }))).toBe('3 × 6–8')
    expect(formatTarget(item('a', { repsMin: 5, repsMax: 5 }))).toBe('3 × 5')
    expect(formatTarget({ key: 'a', movementId: 'a', sets: 3, seconds: 45, restSec: 60 })).toBe('3 × 45 s')
    expect(formatTarget({ key: 'a', movementId: 'a', sets: 1, seconds: 600, meters: 2000, restSec: 0 })).toBe(
      '1 × 10:00 · 2 km',
    )
    expect(formatSeconds(90)).toBe('1:30')
  })
})

describe('supersets and reordering', () => {
  it('moves an item', () => {
    expect(keys(moveItem([item('a'), item('b'), item('c')], 0, 2))).toBe('bca')
    expect(keys(moveItem([item('a'), item('b'), item('c')], 2, 0))).toBe('cab')
  })

  it('links two items into a superset and labels them', () => {
    const linked = linkWithNext([item('a'), item('b'), item('c')], 0)
    expect(linkedToNext(linked, 0)).toBe(true)
    expect(linkedToNext(linked, 1)).toBe(false)
    expect(supersetLabels(linked)).toEqual(['A1', 'A2', undefined])
    // Extending the superset to a third movement keeps one group.
    const three = linkWithNext(linked, 1)
    expect(new Set(three.map((i) => i.group)).size).toBe(1)
    expect(supersetLabels(three)).toEqual(['A1', 'A2', 'A3'])
  })

  it('merges two supersets when linking across them', () => {
    const items = [item('a', { group: 'x' }), item('b', { group: 'x' }), item('c', { group: 'y' }), item('d', { group: 'y' })]
    expect(groups(linkWithNext(items, 1))).toBe('xxxx')
  })

  it('splits a superset', () => {
    const items = [item('a', { group: 'x' }), item('b', { group: 'x' }), item('c', { group: 'x' }), item('d', { group: 'x' })]
    const split = unlinkFromNext(items, 1)
    expect(linkedToNext(split, 1)).toBe(false)
    expect(split[0]!.group).toBe(split[1]!.group)
    expect(split[2]!.group).toBe(split[3]!.group)
    expect(supersetLabels(split)).toEqual(['A1', 'A2', 'B1', 'B2'])
    // Splitting a pair leaves two plain items.
    expect(groups(unlinkFromNext([item('a', { group: 'x' }), item('b', { group: 'x' })], 0))).toBe('--')
  })

  it('drops a superset that moving or removing breaks apart', () => {
    const items = [item('a', { group: 'x' }), item('b', { group: 'x' }), item('c')]
    expect(groups(moveItem(items, 1, 2))).toBe('---') // a, c, b: no longer neighbours
    expect(groups(moveItem(items, 0, 1))).toBe('xx-') // swapped inside the superset
    expect(groups(removeItem(items, 0))).toBe('--')
    expect(groups(normalizeGroups([item('a', { group: 'x' }), item('b'), item('c', { group: 'x' }), item('d', { group: 'x' })]))).toBe(
      '----',
    )
  })

  it('rests only after the last movement of a superset round', () => {
    const items = linkWithNext([item('a', { restSec: 90 }), item('b', { restSec: 60 })], 0)
    expect(effectiveRest(items, 0)).toBe(0)
    expect(effectiveRest(items, 1)).toBe(60)
  })
})

describe('estimated duration', () => {
  it('counts work, rest and a changeover, without rest after the last set', () => {
    // 10 reps → 40 s + 10 s setup = 50 s; 3 sets with 90 s rest, minus the final rest, plus 2 min changeover.
    const one = item('a', { repsMin: 10, repsMax: 10 })
    expect(workSeconds(one)).toBe(50)
    expect(estimateSeconds([one])).toBe(3 * (50 + 90) - 90 + 120)
    expect(estimateSeconds([])).toBe(0)
  })

  it('uses target time for timed sets; a superset rests once per round and has one changeover', () => {
    const plank: WorkoutItem = { key: 'p', movementId: 'Plank', sets: 3, seconds: 30, restSec: 60 }
    expect(workSeconds(plank)).toBe(40)
    const pair = linkWithNext([item('a', { repsMin: 10, repsMax: 10 }), item('b', { repsMin: 10, repsMax: 10, restSec: 60 })], 0)
    expect(estimateSeconds(pair)).toBe(3 * 50 + 3 * (50 + 60) - 60 + 120)
  })

  it('formats minutes and hours', () => {
    expect(formatDuration(52 * 60)).toBe('52 min')
    expect(formatDuration(75 * 60)).toBe('1 h 15 min')
    expect(formatDuration(120 * 60)).toBe('2 h')
  })
})

describe('starter templates', () => {
  const ids = new Set((exercises as { id: string }[]).map((e) => e.id))

  it('ships Push / Pull / Legs, Upper / Lower and a 3-day Full Body', () => {
    expect(STARTER_PROGRAMS.map((p) => p.workouts.length)).toEqual([3, 2, 3])
    expect(new Set(STARTERS.map((w) => w.id)).size).toBe(STARTERS.length)
    for (const w of STARTERS) expect(w.id).toMatch(/^starter-/)
  })

  it('uses real library movements with targets that fit their tracking type', () => {
    for (const w of STARTERS) {
      for (const it of w.items) {
        expect(ids, `${w.name}: ${it.movementId}`).toContain(it.movementId)
        const tracking = TRACKING[it.movementId] ?? 'weight_reps'
        expect(fitTarget(it, tracking), `${w.name}: ${it.movementId}`).toEqual(it)
        expect(targetKind(tracking) === 'reps').toBe(it.repsMin !== undefined)
      }
      expect(normalizeGroups(w.items)).toEqual(w.items)
    }
  })

  it('takes a sensible time (35–70 min)', () => {
    for (const w of STARTERS) {
      const min = estimateSeconds(w.items) / 60
      expect(min, w.name).toBeGreaterThanOrEqual(35)
      expect(min, w.name).toBeLessThanOrEqual(70)
    }
  })
})
