import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { fromDayKey } from '../../../lib/dates'
import type { UnitSystem } from '../../../lib/units'
import { displayWeight, formatNumber, unitLabel } from './weights'

interface Point {
  date: string
  kg: number
}

const HEIGHT = 180
const PAD = { top: 12, right: 12, bottom: 24, left: 40 }
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

/** Round tick values from just below min to just above max (about 3–4 steps). */
function ticks(min: number, max: number): number[] {
  const rough = Math.max(max - min, 1) / 3
  const mag = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= rough) ?? rough
  let lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (lo === hi) {
    lo -= step
    hi += step
  }
  const out: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) out.push(+v.toFixed(4))
  return out
}

/**
 * Best estimated 1RM per session over time: one flat accent line with point
 * markers, a recessive grid, and a crosshair readout on hover / touch.
 * A table with the same numbers sits under it for screen readers and anyone
 * who prefers numbers.
 */
export function E1rmChart({ points, units }: { points: Point[]; units: UnitSystem }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') {
      setWidth(Math.floor(el.clientWidth) || 320)
      return
    }
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = points.map((p) => displayWeight(p.kg, units))
  const unit = unitLabel(units)
  const yTicks = ticks(Math.min(...values), Math.max(...values))
  const yMin = yTicks[0]!
  const yMax = yTicks.at(-1)!
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / Math.max(yMax - yMin, 1)) * plotH
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setActive(best)
  }

  const a = active !== null ? { p: points[active]!, v: values[active]!, cx: x(active), cy: y(values[active]!) } : null

  return (
    <div>
      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Estimated 1RM over ${points.length} sessions, from ${formatNumber(values[0]!)} to ${formatNumber(values.at(-1)!)} ${unit}`}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setActive(null)}
            className="block touch-pan-y"
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line-soft" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted font-display text-[11px]">
                  {formatNumber(t)}
                </text>
              </g>
            ))}
            <text x={PAD.left} y={HEIGHT - 6} className="fill-muted font-display text-[11px]">
              {shortDate.format(fromDayKey(points[0]!.date))}
            </text>
            {points.length > 1 && (
              <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted font-display text-[11px]">
                {shortDate.format(fromDayKey(points.at(-1)!.date))}
              </text>
            )}
            {a && <line x1={a.cx} x2={a.cx} y1={PAD.top} y2={PAD.top + plotH} className="stroke-faint" strokeWidth={1} />}
            <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={active === i ? 5 : 4}
                className={active === i ? 'fill-accent stroke-panel' : 'fill-panel stroke-accent'}
                strokeWidth={2}
              />
            ))}
          </svg>
        )}
        {a && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 border border-panel-edge bg-bg px-2 py-1 text-sm whitespace-nowrap"
            style={{ left: Math.min(Math.max(a.cx - 60, 0), Math.max(0, width - 120)) }}
          >
            <span className="font-display font-bold tabular-nums">
              {formatNumber(a.v)} {unit}
            </span>
            <span className="ml-2 text-muted">{shortDate.format(fromDayKey(a.p.date))}</span>
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="min-h-touch cursor-pointer py-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent">
          Show as table
        </summary>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="label py-1 font-semibold">Date</th>
              <th className="label py-1 text-right font-semibold">Est. 1RM ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={`${p.date}-${i}`} className="border-t border-line-soft">
                <td className="py-1.5">{shortDate.format(fromDayKey(p.date))}</td>
                <td className="py-1.5 text-right tabular-nums">{formatNumber(values[i]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
