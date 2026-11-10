/**
 * Counts Firestore reads and writes per local day on this device, so we can
 * see what a normal day costs against the free Spark limits
 * (50,000 reads and 20,000 writes per day for the whole project).
 * Stored in localStorage: a per-device convenience, not user data.
 */
import { toDayKey } from '../dates'

const KEY = 'fromzero-sync-usage'

export interface Usage {
  date: string
  reads: number
  writes: number
}

function load(): Usage {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Usage | null
    if (saved && typeof saved.reads === 'number' && typeof saved.writes === 'number') return saved
  } catch {
    // Storage blocked or corrupt: start from zero.
  }
  return { date: toDayKey(), reads: 0, writes: 0 }
}

let cache: Usage = load()

/** Today's counts. Returns the same object until something changes (safe for useSyncExternalStore). */
export function getUsage(): Usage {
  const today = toDayKey()
  if (cache.date !== today) cache = { date: today, reads: 0, writes: 0 }
  return cache
}

const listeners = new Set<() => void>()

export function onUsageChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function countUsage(kind: 'reads' | 'writes', n: number): void {
  if (n <= 0) return
  const current = getUsage()
  cache = { ...current, [kind]: current[kind] + n }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Ignore: counting is best-effort.
  }
  console.info(`[sync] +${n} ${kind} · today on this device: ${cache.reads} reads, ${cache.writes} writes`)
  listeners.forEach((fn) => fn())
}
