/**
 * Health Connect → day records (Android app only). Steps and sleep go through
 * `saveStats`, weight through `saveBody`, so every value gets its `statsAt`/`bodyAt`
 * stamp and syncs to the website like a typed one; the automatic-quest liveQuery
 * (`startAutoQuests`) then ticks steps/sleep/weigh-in quests by itself.
 *
 * Runs when the app opens and whenever it comes back into view. The first sync
 * after connecting reads the last 30 days (Health Connect's own limit without the
 * history permission); later ones read from the day before the last sync.
 *
 * Device-only state lives in meta (`health`): whether the user connected, which
 * metrics they chose, when it last ran, and what was imported per day, so a value
 * the user corrected by hand isn't overwritten by the same Health Connect number.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { App } from '@capacitor/app'
import { getMeta, setMeta } from '../../lib/db'
import { addDays, getDayStartHour, getToday } from '../../lib/day'
import { isAndroidApp } from '../../lib/platform'
import {
  grantedHealthMetrics,
  readHealthDays,
  requestHealthAccess,
  type HealthMetric,
} from '../../lib/health/bridge'
import { planHealthWrites, rememberImported, type HealthByDay, type HealthWrite } from '../../lib/health/days'
import { saveBody } from '../body/bodyRepo'
import { saveStats } from './statsRepo'

export const HEALTH_META_KEY = 'health'

/** How far back the first sync reads (Health Connect caps reads at 30 days anyway). */
export const FIRST_SYNC_DAYS = 30
/** Don't re-read when the app comes back within this time. */
const MIN_GAP_MS = 20_000

export interface HealthState {
  connected: boolean
  /** What the user chose on the explanation screen. */
  metrics: HealthMetric[]
  /** What Health Connect allowed at the last sync. */
  granted: HealthMetric[]
  lastSyncAt?: number
  /** The day the last sync ran on ("today" then). */
  lastSyncDay?: string
  imported: HealthByDay
}

const EMPTY: HealthState = { connected: false, metrics: [], granted: [], imported: {} }

export async function getHealthState(): Promise<HealthState> {
  return { ...EMPTY, ...(await getMeta<HealthState>(HEALTH_META_KEY)) }
}

export function useHealthState(): HealthState | undefined {
  return useLiveQuery(getHealthState, [])
}

/** Write the values, one day at a time, through the normal repos. */
async function writeDays(writes: HealthWrite[]): Promise<void> {
  for (const { date, values } of writes) {
    const { steps, sleepMinutes, weightKg } = values
    if (steps !== undefined || sleepMinutes !== undefined) {
      await saveStats(date, {
        ...(steps !== undefined && { steps }),
        ...(sleepMinutes !== undefined && { sleepMinutes }),
      })
    }
    if (weightKg !== undefined) await saveBody(date, { weightKg })
  }
}

let running: Promise<number> | undefined

/**
 * Read Health Connect and write what changed. Returns how many days were written.
 * Does nothing on the website or before the user connected.
 */
export function syncHealth({ force = false } = {}): Promise<number> {
  running ??= (async () => {
    try {
      return await runSync(force)
    } finally {
      running = undefined
    }
  })()
  return running
}

async function runSync(force: boolean): Promise<number> {
  if (!isAndroidApp()) return 0
  const state = await getHealthState()
  if (!state.connected) return 0
  if (!force && state.lastSyncAt && Date.now() - state.lastSyncAt < MIN_GAP_MS) return 0

  const [today, startHour] = await Promise.all([getToday(), getDayStartHour()])
  const granted = (await grantedHealthMetrics()).filter((m) => state.metrics.includes(m))
  const oldest = addDays(today, -(FIRST_SYNC_DAYS - 1))
  let from = state.lastSyncDay ? addDays(state.lastSyncDay, -1) : oldest
  if (from < oldest) from = oldest

  const read = await readHealthDays(from, today, startHour, granted)
  const writes = planHealthWrites(read, state.imported, today)
  await writeDays(writes)

  const latest = await getHealthState()
  await setMeta(HEALTH_META_KEY, {
    ...latest,
    granted,
    lastSyncAt: Date.now(),
    lastSyncDay: today,
    imported: rememberImported(latest.imported, writes, oldest),
  } satisfies HealthState)
  return writes.length
}

/**
 * After the explanation screen: ask Health Connect for these metrics, remember the
 * choice and read the last 30 days. Returns the metrics that were allowed.
 */
export async function connectHealth(metrics: HealthMetric[]): Promise<HealthMetric[]> {
  const granted = await requestHealthAccess(metrics)
  const state = await getHealthState()
  await setMeta(HEALTH_META_KEY, {
    ...state,
    connected: granted.length > 0,
    metrics,
    granted,
    // A new connection reads the full 30 days again.
    lastSyncDay: undefined,
    lastSyncAt: undefined,
  } satisfies HealthState)
  if (granted.length) await syncHealth({ force: true })
  return granted
}

/** Stop reading. Values already imported stay (they're the user's day records now). */
export async function disconnectHealth(): Promise<void> {
  const state = await getHealthState()
  await setMeta(HEALTH_META_KEY, { ...state, connected: false, lastSyncDay: undefined } satisfies HealthState)
}

/** Sync on open and whenever the app comes back into view (main.tsx). No-op on the website. */
export function startHealthSync(): () => void {
  if (!isAndroidApp()) return () => {}
  const run = () => void syncHealth().catch((error: unknown) => console.warn('Health Connect sync failed', error))
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }
  document.addEventListener('visibilitychange', onVisible)
  const listener = App.addListener('resume', run)
  run()
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    void listener.then((l) => l.remove())
  }
}
