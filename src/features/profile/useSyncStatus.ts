import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '../../lib/sync/engine'
import { getUsage, onUsageChange, type Usage } from '../../lib/sync/usage'

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
}

export function useSyncUsage(): Usage {
  return useSyncExternalStore(onUsageChange, getUsage)
}

/** Current time, refreshed every `ms` so "2 min ago" stays right. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })

/** "just now", "2 min ago", "3 hr ago", "yesterday". */
export function timeAgo(then: number, now: number): string {
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}
