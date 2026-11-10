import type { Day, Profile, Quest, QuestDef } from '../db'
import {
  canonical,
  isPristine,
  matchQuests,
  mergeDay,
  mergeProfile,
  mergeRecord,
  newerWins,
  remapDay,
  resolveIncoming,
  toCloud,
} from './merge'

const check = (id: string, done: boolean, at?: number): Quest => ({ id, title: id, xp: 40, kind: 'check', done, at })
const count = (id: string, value: number, at?: number): Quest => ({
  id,
  title: id,
  xp: 20,
  kind: 'count',
  target: 3,
  unit: 'L',
  step: 0.5,
  value,
  done: value >= 3,
  at,
})
const day = (updatedAt: number, quests: Quest[], extra: Partial<Day> = {}): Day => ({
  date: '2026-11-09',
  quests,
  updatedAt,
  ...extra,
})
const profile = (p: Partial<Profile>): Profile => ({
  id: 'me',
  displayName: '',
  units: 'metric',
  rank: 'E',
  bestLevel: 1,
  goals: {},
  updatedAt: 0,
  ...p,
})
const def = (id: string, title: string, order: number, extra: Partial<QuestDef> = {}): QuestDef => ({
  id,
  title,
  xp: 40,
  kind: 'check',
  order,
  updatedAt: 0,
  ...extra,
})

describe('newerWins', () => {
  it('keeps the newer updatedAt', () => {
    expect(newerWins({ updatedAt: 2, v: 'a' }, { updatedAt: 1, v: 'b' }).v).toBe('a')
    expect(newerWins({ updatedAt: 1, v: 'a' }, { updatedAt: 2, v: 'b' }).v).toBe('b')
  })

  it('lets the cloud copy win a tie so every device agrees', () => {
    expect(newerWins({ updatedAt: 5, v: 'local' }, { updatedAt: 5, v: 'cloud' }).v).toBe('cloud')
  })
})

describe('mergeDay — both devices changed the day (concurrent)', () => {
  it('counts a quest as checked if either device checked it', () => {
    const phone = day(100, [check('train', true, 90), check('read', false)])
    const laptop = day(200, [check('train', false), check('read', true, 190)])
    const merged = mergeDay(phone, laptop, true)
    expect(merged.quests.map((q) => [q.id, q.done])).toEqual([
      ['train', true],
      ['read', true],
    ])
  })

  it('keeps the higher amount on count quests', () => {
    const merged = mergeDay(day(100, [count('water', 2.5)]), day(200, [count('water', 1)]), true)
    expect(merged.quests[0]).toMatchObject({ value: 2.5, done: false })
    const full = mergeDay(day(300, [count('water', 3)]), day(200, [count('water', 1)]), true)
    expect(full.quests[0]).toMatchObject({ value: 3, done: true })
  })

  it('is the same whichever side merges', () => {
    const a = day(100, [check('train', true, 90), count('water', 1, 80)])
    const b = day(200, [check('train', false), count('water', 2, 150)])
    expect(canonical(mergeDay(a, b, true))).toBe(canonical(mergeDay(b, a, true)))
  })
})

describe('mergeDay — not concurrent', () => {
  it("keeps a tick that the other device's upload didn't know about", () => {
    // Phone ticked "train" at 100 and uploaded. The laptop, not having seen it yet,
    // ticked "read" at 150 and uploaded its whole day with "train" still unchecked.
    const phone = day(100, [check('train', true, 100), check('read', false)])
    const laptopUpload = day(150, [check('train', false), check('read', true, 150)])
    const merged = mergeDay(phone, laptopUpload, false)
    expect(merged.quests.map((q) => q.done)).toEqual([true, true])
  })

  it('lets a deliberate uncheck travel', () => {
    const phone = day(100, [check('train', true, 100)])
    const laptop = day(300, [check('train', false, 300)]) // unchecked after seeing the tick
    expect(mergeDay(phone, laptop, false).quests[0]!.done).toBe(false)
  })
})

describe('mergeDay — quest lists and other fields', () => {
  it('follows the newer quest list but never drops a quest with progress', () => {
    const older = day(100, [check('train', true, 90), check('stretch', false), check('read', false)])
    const newer = day(200, [check('train', false), check('meditate', false)]) // stretch + read removed
    const merged = mergeDay(older, newer, true)
    expect(merged.quests.map((q) => q.id)).toEqual(['train', 'meditate'])
    expect(merged.quests[0]!.done).toBe(true)

    const withProgress = day(100, [check('stretch', true, 90)])
    expect(mergeDay(withProgress, day(200, []), true).quests.map((q) => q.id)).toEqual(['stretch'])
  })

  it('takes steps, sleep, weight and water from the newer copy, falling back to the older', () => {
    const older = day(100, [], { steps: 4000, weightKg: 80, waterMl: 500 })
    const newer = day(200, [], { steps: 9000, sleepMinutes: 420 })
    expect(mergeDay(older, newer, false)).toMatchObject({ steps: 9000, sleepMinutes: 420, weightKg: 80, waterMl: 500 })
  })

  it('keeps the newest updatedAt and drops local-only fields', () => {
    const merged = mergeDay({ ...day(100, []), dirty: 1 }, day(200, []), true)
    expect(merged.updatedAt).toBe(200)
    expect(merged).not.toHaveProperty('dirty')
  })
})

describe('mergeProfile', () => {
  it('takes settings from the newer copy and the max of rank and best level', () => {
    const phone = profile({ units: 'imperial', rank: 'D', bestLevel: 6, updatedAt: 300 })
    const cloud = profile({ units: 'metric', rank: 'C', bestLevel: 11, displayName: 'Sam', updatedAt: 100 })
    expect(mergeProfile(phone, cloud)).toMatchObject({ units: 'imperial', rank: 'C', bestLevel: 11, updatedAt: 300 })
  })

  it("never lets a rank drop, even when the newer copy hadn't seen it", () => {
    const merged = mergeProfile(profile({ rank: 'B', updatedAt: 1 }), profile({ rank: 'E', updatedAt: 9 }))
    expect(merged.rank).toBe('B')
  })

  it("keeps the account's settings on a device's first sign-in", () => {
    const newPhone = profile({ updatedAt: 999 })
    const account = profile({ units: 'imperial', displayName: 'Sam', updatedAt: 1 })
    expect(mergeProfile(newPhone, account, true)).toMatchObject({ units: 'imperial', displayName: 'Sam' })
  })
})

describe('mergeRecord', () => {
  it('lets a newer deletion win and a newer edit undo an older deletion', () => {
    const live = def('q', 'Train', 0, { updatedAt: 100 })
    const tomb = def('q', 'Train', 0, { updatedAt: 200, deleted: 1 })
    expect(mergeRecord('quests', live, tomb, { concurrent: true }).deleted).toBe(1)
    expect(mergeRecord('quests', { ...live, updatedAt: 300 }, tomb, { concurrent: true }).deleted).toBeUndefined()
  })
})

describe('resolveIncoming', () => {
  it('stores a new cloud record as is', () => {
    const r = resolveIncoming('days', undefined, { ...day(100, []), syncedAt: 5 } as Day)
    expect(r).toEqual({ record: day(100, []), upload: false })
  })

  it('takes a newer cloud copy when nothing is waiting locally', () => {
    const local = { ...def('q', 'Train', 0, { updatedAt: 100 }), dirty: 0 as const }
    const cloud = def('q', 'Train hard', 0, { updatedAt: 200 })
    expect(resolveIncoming('quests', local, cloud)).toEqual({ record: cloud, upload: false })
  })

  it('merges with unsent local changes and uploads the result with a newer time', () => {
    const local = { ...day(100, [check('train', true, 100), check('read', false)]), dirty: 1 as const }
    const cloud = day(200, [check('train', false), check('read', true, 200)])
    const r = resolveIncoming('days', local, cloud, { now: 150 })
    expect(r.upload).toBe(true)
    expect(r.record.updatedAt).toBe(201) // must beat the cloud copy everywhere
    expect((r.record as unknown as Day).quests.map((q) => q.done)).toEqual([true, true])
  })

  it('does not upload when the merge equals the cloud copy', () => {
    const local = { ...day(100, [check('train', true, 100)]), dirty: 1 as const }
    const cloud = day(200, [check('train', true, 100)])
    expect(resolveIncoming('days', local, cloud).upload).toBe(false)
  })
})

describe('first sign-in helpers', () => {
  const DEFAULTS = [
    { title: 'Train', xp: 40, kind: 'check' },
    { title: 'Read 10 pages', xp: 40, kind: 'check' },
  ]

  it('matches starter quests by name and type so they are not duplicated', () => {
    const local = [def('l1', 'Train', 0), def('l2', 'read 10  pages', 1), def('l3', 'Stretch', 2)]
    const remote = [def('r1', 'Train', 0), def('r2', 'Read 10 pages', 1), def('r3', 'Train', 2, { kind: 'count' })]
    expect([...matchQuests(local, remote)]).toEqual([
      ['l1', 'r1'],
      ['l2', 'r2'],
    ])
  })

  it('does not match a deleted cloud quest or reuse one twice', () => {
    const local = [def('l1', 'Train', 0), def('l2', 'Train', 1)]
    const remote = [def('r1', 'Train', 0), def('r2', 'Train', 1, { deleted: 1 })]
    expect([...matchQuests(local, remote)]).toEqual([['l1', 'r1']])
  })

  it('rewrites quest ids inside a day', () => {
    const d = day(1, [check('l1', true), check('keep', false)])
    expect(remapDay(d, new Map([['l1', 'r1']])).quests.map((q) => q.id)).toEqual(['r1', 'keep'])
  })

  it('spots an untouched device', () => {
    const quests = [def('a', 'Train', 0), def('b', 'Read 10 pages', 1)]
    const fresh = { profile: profile({}), quests, days: [day(1, [check('a', false)])], otherRecords: 0 }
    expect(isPristine(fresh, DEFAULTS)).toBe(true)
    expect(isPristine({ ...fresh, days: [day(1, [check('a', true)])] }, DEFAULTS)).toBe(false)
    expect(isPristine({ ...fresh, quests: [quests[0]!] }, DEFAULTS)).toBe(false)
    expect(isPristine({ ...fresh, profile: profile({ units: 'imperial' }) }, DEFAULTS)).toBe(false)
    expect(isPristine({ ...fresh, days: [day(1, [], { weightKg: 80 })] }, DEFAULTS)).toBe(false)
    expect(isPristine({ ...fresh, otherRecords: 1 }, DEFAULTS)).toBe(false)
  })
})

describe('toCloud', () => {
  it('drops dirty, syncedAt and undefined values', () => {
    expect(toCloud({ a: 1, b: undefined, dirty: 1, syncedAt: 3 })).toEqual({ a: 1 })
  })
})

describe('no-op merges', () => {
  it('leaves an untouched day exactly as it was (no needless upload)', () => {
    const d = day(100, [check('train', false), count('water', 0)])
    expect(canonical(mergeDay({ ...d, dirty: 1 }, d, true))).toBe(canonical(d))
    expect(resolveIncoming('days', { ...d, dirty: 1 }, d).upload).toBe(false)
  })
})
