/**
 * The Health Connect bridge (Android app only), via `@capgo/capacitor-health`.
 * FromZero only ever READS steps, sleep and weight; the manifest strips every other
 * health permission the plugin declares. On the website every call is a no-op
 * (`healthSupport()` says 'unsupported' and nothing else touches the plugin).
 * The plugin is imported on demand, so it never loads on the web.
 */
import { dayStartTime } from '../day'
import { isAndroidApp } from '../platform'
import {
  combineDays,
  sleepByDay,
  stepsByDay,
  weightByDay,
  type HealthByDay,
  type HealthField,
  type SleepSession,
} from './days'

/** What the user can let FromZero read. */
export type HealthMetric = 'steps' | 'sleep' | 'weight'

export const HEALTH_METRICS: readonly HealthMetric[] = ['steps', 'sleep', 'weight']

export const HEALTH_METRIC_LABEL: Record<HealthMetric, string> = { steps: 'Steps', sleep: 'Sleep', weight: 'Weight' }

const DATA_TYPE = { steps: 'steps', sleep: 'sleep', weight: 'weight' } as const
const FIELD: Record<HealthMetric, HealthField> = { steps: 'steps', sleep: 'sleepMinutes', weight: 'weightKg' }

/** 'unsupported' = not the Android app; 'unavailable' = Health Connect missing or needs an update. */
export type HealthSupport = 'unsupported' | 'unavailable' | 'available'

const plugin = async () => (await import('@capgo/capacitor-health')).Health

export async function healthSupport(): Promise<HealthSupport> {
  if (!isAndroidApp()) return 'unsupported'
  try {
    const { available } = await (await plugin()).isAvailable()
    return available ? 'available' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

function metricsFrom(types: string[]): HealthMetric[] {
  return HEALTH_METRICS.filter((m) => types.includes(DATA_TYPE[m]))
}

/** Opens Health Connect's permission sheet for these metrics; returns the ones granted. */
export async function requestHealthAccess(metrics: HealthMetric[]): Promise<HealthMetric[]> {
  if (!isAndroidApp() || !metrics.length) return []
  const status = await (await plugin()).requestAuthorization({ read: metrics.map((m) => DATA_TYPE[m]) })
  return metricsFrom(status.readAuthorized)
}

/** The metrics FromZero may read right now (the user can change this in Health Connect at any time). */
export async function grantedHealthMetrics(): Promise<HealthMetric[]> {
  if (!isAndroidApp()) return []
  const status = await (await plugin()).checkAuthorization({ read: HEALTH_METRICS.map((m) => DATA_TYPE[m]) })
  return metricsFrom(status.readAuthorized)
}

/** Health Connect's own settings (permissions, data, or installing it). */
export async function openHealthConnectSettings(): Promise<void> {
  if (!isAndroidApp()) return
  await (await plugin()).openHealthConnectSettings()
}

/**
 * Read the given metrics for the days `from`..`to` (inclusive day keys).
 * A metric that fails (e.g. permission just revoked) is skipped, not fatal.
 */
export async function readHealthDays(
  from: string,
  to: string,
  startHour: number,
  metrics: HealthMetric[],
): Promise<HealthByDay> {
  if (!isAndroidApp() || !metrics.length) return {}
  const health = await plugin()
  const start = new Date(dayStartTime(from, startHour))
  const end = new Date(Math.min(Date.now(), dayStartTime(to, startHour) + 36 * 3_600_000))
  const startDate = start.toISOString()
  const endDate = end.toISOString()
  const parts: Partial<Record<HealthField, Record<string, number>>> = {}

  const tasks = metrics.map(async (metric) => {
    try {
      if (metric === 'steps') {
        // Hourly totals: Health Connect removes duplicates (phone + watch), and hours split cleanly into days.
        const { samples } = await health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'hour', aggregation: 'sum' })
        parts[FIELD.steps] = stepsByDay(samples, startHour)
      } else if (metric === 'sleep') {
        // From 18 hours earlier, so the night that ends on the first day is complete.
        const sleepStart = new Date(start.getTime() - 18 * 3_600_000).toISOString()
        const { samples } = await health.readSamples({ dataType: 'sleep', startDate: sleepStart, endDate, limit: 1000, ascending: true })
        parts[FIELD.sleep] = sleepByDay(samples as SleepSession[], startHour)
      } else {
        const { samples } = await health.readSamples({ dataType: 'weight', startDate, endDate, limit: 1000, ascending: true })
        parts[FIELD.weight] = weightByDay(samples, startHour)
      }
    } catch (error) {
      console.warn(`Health Connect: reading ${metric} failed`, error)
    }
  })
  await Promise.all(tasks)

  // Drop days outside the asked range (e.g. the start of the sleep window).
  const days = combineDays(parts)
  for (const key of Object.keys(days)) if (key < from || key > to) delete days[key]
  return days
}
