/**
 * Pure merge rules for account sync. No Dexie or Firestore in here, so every
 * rule is unit-tested in `merge.test.ts`.
 *
 * Rules (from CLAUDE.md / the sync brief):
 * - Same record changed in two places: the newer `updatedAt` wins.
 * - A day's quests merge quest by quest:
 *   - both devices changed the day before seeing each other's change
 *     (the local copy still has unsent changes) → a quest checked on either
 *     device counts as checked; count quests keep the higher amount;
 *   - otherwise each quest keeps its newest change (`at`), so an upload from a
 *     device that hadn't seen another device's tick can't wipe that tick out,
 *     and a deliberate uncheck still travels.
 * - Profile: settings from the newer copy; earned rank and best level take the max.
 * - Nothing is thrown away silently: a quest that exists in only one copy of a
 *   day is kept if it has any progress.
 */
import type { BodyField, Day, DayStat, MeasureKey, Profile, Quest, QuestDef, SyncedTable, SyncFields } from '../db'
import { rankIndex } from '../rank'

type AnyRecord = SyncFields

/** Device-only fields that never go to (or come from) the cloud. */
const LOCAL_ONLY = new Set(['dirty', 'syncedAt'])

/** The record as stored in the cloud: no local-only fields, no undefined values. */
export function toCloud<T extends object>(record: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (!LOCAL_ONLY.has(k) && v !== undefined) out[k] = v
  }
  return out as T
}

/** Stable JSON (sorted keys) of the cloud shape, to compare two records' content. */
export function canonical(record: object): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, sort(x)]),
      )
    }
    return v
  }
  return JSON.stringify(sort(toCloud(record)))
}

export function sameContent(a: object, b: object): boolean {
  return canonical(a) === canonical(b)
}

/** Newer `updatedAt` wins; on a tie the cloud copy wins so every device agrees. */
export function newerWins<T extends SyncFields>(local: T, remote: T): T {
  return local.updatedAt > remote.updatedAt ? local : remote
}

function hasProgress(q: Quest): boolean {
  return q.done || (q.value ?? 0) > 0
}

/** The later of two change times, or undefined when neither quest was ever touched. */
function laterAt(a: Quest, b: Quest): number | undefined {
  const at = Math.max(a.at ?? 0, b.at ?? 0)
  return at > 0 ? at : undefined
}

function mergeQuest(newer: Quest, older: Quest, concurrent: boolean): Quest {
  if (newer.kind !== older.kind) return newer // quest type changed: the newer definition stands
  if (concurrent) {
    if (newer.kind === 'count') {
      const value = Math.max(newer.value ?? 0, older.value ?? 0)
      return { ...newer, value, done: value >= (newer.target ?? 1), at: laterAt(newer, older) }
    }
    return { ...newer, done: newer.done || older.done, at: laterAt(newer, older) }
  }
  // Not concurrent: the newest change to this quest's progress wins.
  const progressFrom = (older.at ?? 0) > (newer.at ?? 0) ? older : newer
  return { ...newer, value: progressFrom.value, done: progressFrom.done, at: progressFrom.at }
}

const MEASURE_KEYS: readonly MeasureKey[] = ['waistCm', 'chestCm', 'hipsCm', 'armCm', 'thighCm']

function bodyValue(day: Day, field: BodyField): number | undefined {
  return field === 'weightKg' ? day.weightKg : day.measurements?.[field]
}

/**
 * Body values (weigh-in, measurements) merge one by one: each comes from the
 * copy that changed it last (`bodyAt`), so a removed value stays removed and
 * a weigh-in on one phone doesn't undo a waist measurement on the other.
 * Values from before `bodyAt` existed fall back to newer-else-older.
 */
function mergeBody(newer: Day, older: Day): Pick<Day, 'weightKg' | 'measurements' | 'bodyAt'> {
  const bodyAt: Partial<Record<BodyField, number>> = {}
  const values: Partial<Record<BodyField, number>> = {}
  for (const field of ['weightKg', ...MEASURE_KEYS] as const) {
    const atNewer = newer.bodyAt?.[field] ?? 0
    const atOlder = older.bodyAt?.[field] ?? 0
    const value =
      atNewer || atOlder
        ? bodyValue(atOlder > atNewer ? older : newer, field)
        : (bodyValue(newer, field) ?? bodyValue(older, field))
    if (value !== undefined) values[field] = value
    if (atNewer || atOlder) bodyAt[field] = Math.max(atNewer, atOlder)
  }
  const { weightKg, ...measurements } = values
  return {
    weightKg,
    measurements: Object.keys(measurements).length ? measurements : undefined,
    bodyAt: Object.keys(bodyAt).length ? bodyAt : undefined,
  }
}

const DAY_STATS: readonly DayStat[] = ['steps', 'sleepMinutes', 'waterMl']

/** Steps, sleep and water merge one by one by `statsAt`, like body values. */
function mergeStats(newer: Day, older: Day): Pick<Day, DayStat | 'statsAt'> {
  const statsAt: Partial<Record<DayStat, number>> = {}
  const out: Pick<Day, DayStat> = {}
  for (const field of DAY_STATS) {
    const atNewer = newer.statsAt?.[field] ?? 0
    const atOlder = older.statsAt?.[field] ?? 0
    out[field] = atNewer || atOlder ? (atOlder > atNewer ? older : newer)[field] : (newer[field] ?? older[field])
    if (atNewer || atOlder) statsAt[field] = Math.max(atNewer, atOlder)
  }
  return { ...out, statsAt: Object.keys(statsAt).length ? statsAt : undefined }
}

/**
 * Merge two copies of the same day.
 * `concurrent` = the local copy has changes the cloud hasn't seen yet.
 */
export function mergeDay(local: Day, remote: Day, concurrent: boolean): Day {
  const newer = local.updatedAt > remote.updatedAt ? local : remote
  const older = newer === local ? remote : local

  const olderById = new Map(older.quests.map((q) => [q.id, q]))
  const newerIds = new Set(newer.quests.map((q) => q.id))
  // A copy with no quests only holds body data (made before that device's first
  // quest day): the other copy's quest list stands.
  const quests: Quest[] =
    newer.quests.length === 0
      ? older.quests
      : newer.quests.map((q) => {
          const other = olderById.get(q.id)
          return other ? mergeQuest(q, other, concurrent) : q
        })
  // Quests only the older copy has: keep them if they hold progress (never lose a tick).
  if (newer.quests.length > 0) {
    for (const q of older.quests) {
      if (!newerIds.has(q.id) && hasProgress(q)) quests.push(q)
    }
  }

  const merged: Day = {
    ...older,
    ...newer,
    quests,
    ...mergeStats(newer, older),
    ...mergeBody(newer, older),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
  return toCloud(merged)
}

/**
 * Merge two copies of the profile. Settings come from the newer copy (or from
 * the cloud when `preferRemote`, used on a device's first sign-in so a new
 * phone's defaults don't overwrite the account's settings). Rank and best level
 * only go up.
 */
export function mergeProfile(local: Profile, remote: Profile, preferRemote = false): Profile {
  const base = preferRemote ? remote : newerWins(local, remote)
  const rank = rankIndex(local.rank) > rankIndex(remote.rank) ? local.rank : remote.rank
  return {
    ...base,
    rank,
    bestLevel: Math.max(local.bestLevel, remote.bestLevel),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

export interface MergeOptions {
  /** The local copy has changes the cloud hasn't seen (it's flagged dirty). */
  concurrent: boolean
  /** First sign-in on this device: the account's settings win. */
  preferRemote?: boolean
}

/** Merge a local and a cloud copy of the same record. */
export function mergeRecord(table: SyncedTable, local: AnyRecord, remote: AnyRecord, opts: MergeOptions): AnyRecord {
  if (local.deleted || remote.deleted) return newerWins(local, remote)
  if (table === 'days') {
    return mergeDay(local as unknown as Day, remote as unknown as Day, opts.concurrent) as unknown as AnyRecord
  }
  if (table === 'profile') {
    return mergeProfile(local as unknown as Profile, remote as unknown as Profile, opts.preferRemote) as unknown as AnyRecord
  }
  if (table === 'quests' && opts.preferRemote) return remote
  return newerWins(local, remote)
}

export interface Resolution {
  /** What to store locally (without `dirty`). */
  record: AnyRecord
  /** The result differs from the cloud copy, so it must be uploaded. */
  upload: boolean
}

/**
 * Decide what to do with a record that arrived from the cloud.
 * When the merge result differs from the cloud copy it gets a fresh
 * `updatedAt` (newer than the cloud's) so it wins on every other device too.
 */
export function resolveIncoming(
  table: SyncedTable,
  local: AnyRecord | undefined,
  remote: AnyRecord,
  { preferRemote = false, now = Date.now() }: { preferRemote?: boolean; now?: number } = {},
): Resolution {
  const cloud = toCloud(remote)
  if (!local) return { record: cloud, upload: false }
  const merged = toCloud(mergeRecord(table, local, cloud, { concurrent: local.dirty === 1, preferRemote }))
  if (sameContent(merged, cloud)) return { record: cloud, upload: false }
  return { record: { ...merged, updatedAt: Math.max(now, cloud.updatedAt + 1) }, upload: true }
}

// ---- First sign-in --------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Match this device's quests to the account's by name and type, so a second
 * phone's starter quests (same names, different ids) become the same quests
 * instead of duplicates. Returns local id → account id.
 */
export function matchQuests(local: readonly QuestDef[], remote: readonly QuestDef[]): Map<string, string> {
  const remoteIds = new Set(remote.map((q) => q.id))
  const free = remote.filter((q) => !q.deleted)
  const used = new Set<string>()
  const map = new Map<string, string>()
  for (const q of local) {
    if (q.deleted || remoteIds.has(q.id)) continue
    const match = free.find((r) => !used.has(r.id) && r.kind === q.kind && norm(r.title) === norm(q.title))
    if (match) {
      used.add(match.id)
      map.set(q.id, match.id)
    }
  }
  return map
}

/** Rewrite quest ids inside a day after `matchQuests`. */
export function remapDay(day: Day, ids: ReadonlyMap<string, string>): Day {
  if (!day.quests.some((q) => ids.has(q.id))) return day
  const seen = new Set<string>()
  const quests = day.quests
    .map((q) => ({ ...q, id: ids.get(q.id) ?? q.id }))
    .filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)))
  return { ...day, quests }
}

export interface DefaultQuest {
  title: string
  xp: number
  kind: string
}

/**
 * True when this device holds nothing the user made: only the untouched
 * starter quests, no progress on any day, default settings. On first sign-in
 * such a device simply takes the account's data instead of merging in the
 * starter quests (which would bring deleted defaults back).
 */
export function isPristine(
  data: { profile?: Profile; quests: readonly QuestDef[]; days: readonly Day[]; otherRecords: number },
  defaults: readonly DefaultQuest[],
): boolean {
  if (data.otherRecords > 0) return false
  const p = data.profile
  if (
    p &&
    (p.displayName !== '' ||
      p.units !== 'metric' ||
      p.heightUnits !== undefined ||
      p.dayStartHour !== undefined ||
      p.goalWeightKg !== undefined ||
      p.body !== undefined ||
      p.plan !== undefined ||
      Object.keys(p.goals ?? {}).length > 0)
  ) {
    return false
  }
  if (data.quests.length !== defaults.length) return false
  const sameDefaults = data.quests.every((q) => {
    const d = defaults[q.order]
    return !q.deleted && d && q.title === d.title && q.xp === d.xp && q.kind === d.kind
  })
  if (!sameDefaults) return false
  return data.days.every(
    (d) =>
      !d.quests.some(hasProgress) &&
      d.steps === undefined &&
      d.sleepMinutes === undefined &&
      d.weightKg === undefined &&
      d.measurements === undefined &&
      d.waterMl === undefined,
  )
}
