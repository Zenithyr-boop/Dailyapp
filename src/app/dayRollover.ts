import { closeOutDays } from '../features/quests/closeOut'
import { dayClock } from '../lib/day'

/**
 * Start the app's day clock and close out days: once on opening (catches up
 * on every day the app wasn't opened) and again whenever the day changes.
 */
export function initDayRollover(): void {
  dayClock.onNewDay(() => void closeOutDays())
  dayClock.start()
  void closeOutDays()
}
