/**
 * Reordering and supersets. A superset is a run of neighbouring items that
 * share a `group`. Pure functions, unit-tested in `supersets.test.ts`.
 */
import type { WorkoutItem } from '../../../lib/db'
import { newKey } from './targets'

/**
 * Keep each group only where it forms one run of 2+ neighbours. A group split
 * in two keeps its first run; single leftovers become plain items.
 */
export function normalizeGroups(items: readonly WorkoutItem[]): WorkoutItem[] {
  const seen = new Set<string>()
  const out = items.map((item) => ({ ...item }))
  let i = 0
  while (i < out.length) {
    const g = out[i]!.group
    let j = i + 1
    if (g) while (j < out.length && out[j]!.group === g) j++
    if (g && (seen.has(g) || j - i < 2)) {
      for (let k = i; k < j; k++) delete out[k]!.group
    }
    if (g) seen.add(g)
    i = j
  }
  return out
}

/** Move one item to a new position. */
export function moveItem(items: readonly WorkoutItem[], from: number, to: number): WorkoutItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return normalizeGroups(next)
}

export function removeItem(items: readonly WorkoutItem[], index: number): WorkoutItem[] {
  return normalizeGroups(items.filter((_, i) => i !== index))
}

/**
 * Rest after a set of item `index`: 0 when it leads straight into the next
 * movement of its superset (the round rests once, after its last movement).
 */
export function effectiveRest(items: readonly WorkoutItem[], index: number): number {
  return linkedToNext(items, index) ? 0 : items[index]!.restSec
}

/** Is item `index` linked to the one after it? */
export function linkedToNext(items: readonly WorkoutItem[], index: number): boolean {
  const g = items[index]?.group
  return !!g && items[index + 1]?.group === g
}

/**
 * Join item `index` and the next one into a superset (merging their groups if
 * both already belong to one).
 */
export function linkWithNext(items: readonly WorkoutItem[], index: number): WorkoutItem[] {
  const a = items[index]
  const b = items[index + 1]
  if (!a || !b) return [...items]
  const group = a.group ?? b.group ?? newKey()
  const absorb = b.group && b.group !== group ? b.group : undefined
  const next = items.map((item, i) => {
    if (i === index) return { ...item, group }
    if (i === index + 1 || (absorb && item.group === absorb)) return { ...item, group }
    return item
  })
  return normalizeGroups(next)
}

/** Split the superset between item `index` and the next one. */
export function unlinkFromNext(items: readonly WorkoutItem[], index: number): WorkoutItem[] {
  if (!linkedToNext(items, index)) return [...items]
  const g = items[index]!.group
  const fresh = newKey()
  // Groups are single runs (normalizeGroups), so every later member is in the second half.
  const next = items.map((item, i) => {
    if (i > index && item.group === g) return { ...item, group: fresh }
    return item
  })
  return normalizeGroups(next)
}

/**
 * Labels for display: superset members get "A1", "A2", "B1"…; plain items
 * get undefined. Letters count supersets in order.
 */
export function supersetLabels(items: readonly WorkoutItem[]): (string | undefined)[] {
  const labels: (string | undefined)[] = []
  let letter = -1
  let pos = 0
  items.forEach((item, i) => {
    if (!item.group) {
      labels.push(undefined)
      return
    }
    if (items[i - 1]?.group !== item.group) {
      letter++
      pos = 0
    }
    pos++
    labels.push(`${String.fromCharCode(65 + (letter % 26))}${pos}`)
  })
  return labels
}
