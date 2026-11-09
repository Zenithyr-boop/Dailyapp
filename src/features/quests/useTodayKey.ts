import { useEffect, useState } from 'react'
import { msUntilMidnight, toDayKey } from '../../lib/dates'

/**
 * Today's `YYYY-MM-DD` key, updated at local midnight and whenever the app
 * comes back to the foreground (phones pause timers in the background).
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => toDayKey())

  useEffect(() => {
    const refresh = () => setKey(toDayKey())
    // +500ms so we land safely after midnight.
    const timer = window.setTimeout(refresh, msUntilMidnight() + 500)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [key])

  return key
}
