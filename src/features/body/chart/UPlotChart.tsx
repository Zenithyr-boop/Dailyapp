/**
 * The uPlot canvas behind `TrendChart`. Loaded on demand (own chunk), so uPlot
 * costs nothing until a Body chart is on screen. Colours come from the Midnight
 * tokens on :root, never raw hex.
 */
import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { fromDayKey } from '../../../lib/day'
import type { ChartProps } from './TrendChart'

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const AXIS_FONT = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif'
const DAY_S = 86_400

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return v || fallback
}

/** Round numbers for the y axis ("82", "82.5"). */
const tickText = (v: number) => String(+v.toFixed(1))

export default function UPlotChart({ dates, series, goal, height, ariaLabel, onCursor }: ChartProps & { onCursor: (i: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cursorRef = useRef(onCursor)
  useEffect(() => {
    cursorRef.current = onCursor
  }, [onCursor])

  useEffect(() => {
    const el = box.current
    if (!el) return
    // These fall back to `currentColor`-ish values only if the tokens are missing.
    const c = {
      accent: token('accent', 'currentColor'),
      muted: token('muted', 'gray'),
      faint: token('faint', 'gray'),
      line: token('line', 'gray'),
      lineSoft: token('line-soft', 'gray'),
      panel: token('panel', 'black'),
    }
    const xs = dates.map((d) => fromDayKey(d).getTime() / 1000)
    const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
    const dataMin = Math.min(...all)
    const dataMax = Math.max(...all)

    const opts: uPlot.Options = {
      width: Math.max(1, Math.floor(el.clientWidth)),
      height,
      padding: [12, 12, 0, 0],
      legend: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      cursor: {
        y: false,
        drag: { x: false, y: false },
        points: { size: 9, width: 2, fill: c.panel, stroke: c.accent },
      },
      scales: {
        x: {
          time: true,
          range: (_u, min, max) => (min === max ? [min - 3 * DAY_S, max + 3 * DAY_S] : [min, max]),
        },
        y: {
          range: () => {
            let lo = dataMin
            let hi = dataMax
            // Show the goal when it's near the data, without squashing the trend.
            if (goal !== undefined) {
              const reach = Math.max((hi - lo) * 0.6, 1.5)
              if (goal >= lo - reach && goal <= hi + reach) {
                lo = Math.min(lo, goal)
                hi = Math.max(hi, goal)
              }
            }
            const pad = Math.max((hi - lo) * 0.12, 0.5)
            return [lo - pad, hi + pad]
          },
        },
      },
      axes: [
        {
          stroke: c.muted,
          font: AXIS_FONT,
          space: 64,
          grid: { show: false },
          ticks: { stroke: c.line, width: 1, size: 4 },
          values: (_u, splits) => splits.map((s) => shortDate.format(new Date(s * 1000))),
        },
        {
          stroke: c.muted,
          font: AXIS_FONT,
          size: 44,
          gap: 6,
          space: 36,
          grid: { stroke: c.lineSoft, width: 1 },
          ticks: { show: false },
          values: (_u, splits) => splits.map(tickText),
        },
      ],
      series: [
        {},
        ...series.map((s): uPlot.Series => {
          const dots = s.style !== 'line'
          const line = s.style !== 'dots'
          return {
            label: s.label,
            spanGaps: true,
            stroke: line ? c.accent : c.muted,
            width: line ? 2 : 0,
            ...(line ? {} : { paths: () => null }),
            points: dots
              ? { show: true, size: line ? 7 : 6, width: 1.5, stroke: line ? c.accent : c.muted, fill: c.panel }
              : { show: false },
          }
        }),
      ],
      hooks: {
        setCursor: [(u) => cursorRef.current(u.cursor.idx ?? null)],
        draw: [
          (u) => {
            if (goal === undefined) return
            const y = Math.round(u.valToPos(goal, 'y', true)) + 0.5
            const { left, top, width, height: h } = u.bbox
            if (y < top || y > top + h) return
            const ctx = u.ctx
            ctx.save()
            ctx.strokeStyle = c.faint
            ctx.lineWidth = uPlot.pxRatio
            ctx.setLineDash([6 * uPlot.pxRatio, 4 * uPlot.pxRatio])
            ctx.beginPath()
            ctx.moveTo(left, y)
            ctx.lineTo(left + width, y)
            ctx.stroke()
            ctx.fillStyle = c.muted
            ctx.font = AXIS_FONT.replace('12px', `${12 * uPlot.pxRatio}px`)
            ctx.textAlign = 'right'
            ctx.textBaseline = 'bottom'
            ctx.fillText('GOAL', left + width - 4 * uPlot.pxRatio, y - 3 * uPlot.pxRatio)
            ctx.restore()
          },
        ],
      },
    }

    const u = new uPlot(opts, [xs, ...series.map((s) => s.values)] as uPlot.AlignedData, el)
    u.root.querySelector('canvas')?.setAttribute('aria-hidden', 'true')

    // Touch: move the readout while dragging a finger across (vertical scroll still works).
    const over = u.over
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      const rect = over.getBoundingClientRect()
      u.setCursor({ left: e.clientX - rect.left, top: e.clientY - rect.top })
    }
    over.style.touchAction = 'pan-y'
    over.addEventListener('pointerdown', onTouch)
    over.addEventListener('pointermove', onTouch)

    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry!.contentRect.width)
      if (w > 0 && w !== u.width) u.setSize({ width: w, height })
    })
    ro.observe(el)
    // Axis labels were measured before the web font loaded: redraw once it has.
    void document.fonts?.ready.then(() => u.redraw(false, true))

    return () => {
      ro.disconnect()
      over.removeEventListener('pointerdown', onTouch)
      over.removeEventListener('pointermove', onTouch)
      u.destroy()
    }
  }, [dates, series, goal, height])

  return <div ref={box} role="img" aria-label={ariaLabel} className="fz-chart" style={{ height }} />
}
