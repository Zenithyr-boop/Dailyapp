import { lazy, Suspense, useState } from 'react'
import { fromDayKey } from '../../../lib/day'

export interface ChartSeries {
  label: string
  /** One value per date (null = none that day). */
  values: (number | null)[]
  /** dots = raw readings; line = a trend; line-dots = a line through readings. */
  style: 'dots' | 'line' | 'line-dots'
}

export interface ChartProps {
  /** `YYYY-MM-DD`, oldest first. */
  dates: string[]
  series: ChartSeries[]
  /** Goal value, drawn as a dashed line when it's in view. */
  goal?: number
  height: number
  ariaLabel: string
}

const UPlotChart = lazy(() => import('./UPlotChart'))
const readoutDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const tableDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Canvas charts need a real browser (not the test DOM). */
function canDrawCharts(): boolean {
  try {
    return typeof window.matchMedia === 'function' && typeof ResizeObserver !== 'undefined' && !!document.createElement('canvas').getContext('2d')
  } catch {
    return false
  }
}

/**
 * A Midnight-styled uPlot chart with a readout (the hovered / touched point,
 * else the latest) and the same numbers as a table for screen readers and
 * anyone who prefers them.
 */
export function TrendChart({ format, unit, ...props }: ChartProps & { format: (v: number) => string; unit: string }) {
  const [supported] = useState(canDrawCharts)
  const [active, setActive] = useState<number | null>(null)
  const { dates, series, height } = props
  const idx = active ?? dates.length - 1

  return (
    <div>
      <div aria-hidden="true" className="mb-2 flex min-h-6 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        {dates[idx] && (
          <>
            <span className="text-muted">{readoutDate.format(fromDayKey(dates[idx]))}</span>
            {series.map((s) => {
              const v = s.values[idx]
              return v === null || v === undefined ? null : (
                <span key={s.label}>
                  <span className="label mr-1.5">{s.label}</span>
                  <span className="font-display text-base font-bold tabular-nums">
                    {format(v)} {unit}
                  </span>
                </span>
              )
            })}
          </>
        )}
      </div>
      {supported ? (
        <Suspense fallback={<div style={{ height }} />}>
          <UPlotChart {...props} onCursor={setActive} />
        </Suspense>
      ) : (
        <p className="sr-only">{props.ariaLabel}</p>
      )}
      <details className="mt-2">
        <summary className="min-h-touch cursor-pointer py-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent">
          Show as table
        </summary>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="label py-1 font-semibold">Date</th>
                {series.map((s) => (
                  <th key={s.label} className="label py-1 text-right font-semibold">
                    {s.label} ({unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates
                .map((d, i) => ({ d, i }))
                .reverse()
                .map(({ d, i }) => (
                  <tr key={d} className="border-t border-line-soft">
                    <td className="py-1.5">{tableDate.format(fromDayKey(d))}</td>
                    {series.map((s) => {
                      const v = s.values[i]
                      return (
                        <td key={s.label} className="py-1.5 text-right tabular-nums">
                          {v === null || v === undefined ? '–' : format(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
