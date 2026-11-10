import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

interface DragState {
  from: number
  to: number
  /** How far the dragged item moved, px. */
  dy: number
  /** Height of the dragged item's slot, px (others shift by this much). */
  slot: number
  /** Pointer position (page Y) and item positions when the drag started. */
  startY: number
  tops: number[]
  heights: number[]
}

const EDGE = 80
const SCROLL_STEP = 14

/**
 * Drag-to-reorder for a vertical list, with pointer events so it works with a
 * mouse, a finger or a pen. Items are the children of the nearest `<ol>` /
 * `<ul>` marked `data-drag-item`; each has a handle that gets `handleProps(index)`.
 * Arrow keys on the handle move the item too.
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)

  function pageY(e: PointerEvent) {
    return e.clientY + window.scrollY
  }

  function handleProps(index: number) {
    return {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        const list = e.currentTarget.closest('ol, ul')
        if (e.button !== 0 || !list) return
        const items = [...list.querySelectorAll<HTMLElement>(':scope > [data-drag-item]')]
        const rects = items.map((el) => el.getBoundingClientRect())
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        setDrag({
          from: index,
          to: index,
          dy: 0,
          slot: rects[index]?.height ?? 0,
          startY: pageY(e),
          tops: rects.map((r) => r.top + window.scrollY),
          heights: rects.map((r) => r.height),
        })
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const s = drag
        if (!s) return
        if (e.clientY < EDGE) window.scrollBy(0, -SCROLL_STEP)
        else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP)
        const dy = pageY(e) - s.startY
        const center = s.tops[s.from]! + s.heights[s.from]! / 2 + dy
        let to = 0
        for (let k = 0; k < s.tops.length; k++) {
          if (k !== s.from && center > s.tops[k]! + s.heights[k]! / 2) to++
        }
        setDrag({ ...s, dy, to })
      },
      onPointerUp() {
        if (drag && drag.to !== drag.from) onMove(drag.from, drag.to)
        setDrag(null)
      },
      onPointerCancel() {
        setDrag(null)
      },
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault()
          onMove(index, index - 1)
        } else if (e.key === 'ArrowDown' && index < count - 1) {
          e.preventDefault()
          onMove(index, index + 1)
        }
      },
      style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' } as CSSProperties,
    }
  }

  /** Style for item `index` while dragging: the dragged one follows the pointer, the others make room. */
  function itemStyle(index: number): CSSProperties | undefined {
    if (!drag) return undefined
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 10 }
    const shift =
      drag.from < drag.to && index > drag.from && index <= drag.to
        ? -drag.slot
        : drag.from > drag.to && index >= drag.to && index < drag.from
          ? drag.slot
          : 0
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 150ms ease-out' }
  }

  return { dragging: drag?.from ?? null, handleProps, itemStyle }
}
