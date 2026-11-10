import { formatSeconds } from '../workouts/targets'
import { ADJUST_SECONDS, adjustRest, skipRest, useRestTimer } from './restTimer'

/**
 * Big rest countdown pinned to the bottom of the screen (above the tab bar on
 * phones, beside the side nav on desktop). Hidden when no rest is running.
 */
export function RestTimerBar() {
  const { timer, left } = useRestTimer()
  if (!timer || left <= 0) return null
  const filled = Math.max(0, Math.min(10, Math.round((left / timer.total) * 10)))
  const btn =
    'min-h-touch min-w-14 border border-panel-edge px-3 font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent'

  return (
    <section
      aria-label="Rest timer"
      className="fixed inset-x-0 bottom-[calc(3.5625rem+env(safe-area-inset-bottom))] z-30 border-t border-panel-edge bg-panel md:bottom-0 md:left-60"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 md:max-w-none md:px-8">
        <div className="min-w-0 flex-1">
          <p className="label truncate">Rest · {timer.label}</p>
          <p role="timer" aria-live="off" className="font-display text-5xl font-extrabold leading-none tabular-nums text-accent">
            {formatSeconds(left).replace(' s', '')}
            {left < 60 && <span className="ml-1 text-xl text-muted">s</span>}
          </p>
          <div aria-hidden="true" className="mt-1.5 grid max-w-48 grid-cols-10 gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`h-1.5 ${i < filled ? 'bg-accent' : 'bg-line'}`} />
            ))}
          </div>
        </div>
        <button type="button" className={btn} onClick={() => adjustRest(-ADJUST_SECONDS)} aria-label="15 seconds less rest">
          −15s
        </button>
        <button type="button" className={btn} onClick={() => adjustRest(ADJUST_SECONDS)} aria-label="15 seconds more rest">
          +15s
        </button>
        <button
          type="button"
          className="min-h-touch bg-accent px-4 font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text"
          onClick={() => skipRest()}
        >
          Skip
        </button>
      </div>
    </section>
  )
}
