import { useDeferredValue, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { CATEGORIES, EQUIPMENT, MUSCLES } from './catalog'
import type { MovementFilters } from './search'

export const FILTER_GROUPS = [
  { key: 'muscle', title: 'Muscle', values: MUSCLES },
  { key: 'equipment', title: 'Equipment', values: EQUIPMENT },
  { key: 'category', title: 'Category', values: CATEGORIES },
] as const
export type GroupKey = (typeof FILTER_GROUPS)[number]['key']
export type Selected = Record<GroupKey, Set<string>>

function readSet(params: URLSearchParams, key: GroupKey): Set<string> {
  return new Set((params.get(key) ?? '').split(',').filter(Boolean))
}

export interface MovementSearch {
  query: string
  /** The query to search with (deferred, so typing stays smooth). */
  deferredQuery: string
  setQuery: (value: string) => void
  selected: Selected
  filters: MovementFilters
  filterCount: number
  toggle: (group: GroupKey, value: string) => void
  clearFilters: () => void
}

/** Search query and filters, kept in the URL (`q`, `muscle`, `equipment`, `category`) so Back keeps them. */
export function useMovementSearch(): MovementSearch {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const selected = useMemo(
    () => ({ muscle: readSet(params, 'muscle'), equipment: readSet(params, 'equipment'), category: readSet(params, 'category') }),
    [params],
  )
  const filters: MovementFilters = useMemo(
    () => ({ muscles: selected.muscle, equipment: selected.equipment, categories: selected.category }),
    [selected],
  )

  function update(change: (p: URLSearchParams) => void) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        change(next)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  return {
    query,
    deferredQuery,
    selected,
    filters,
    filterCount: selected.muscle.size + selected.equipment.size + selected.category.size,
    setQuery: (value) => update((p) => (value ? p.set('q', value) : p.delete('q'))),
    toggle: (group, value) =>
      update((p) => {
        const set = readSet(p, group)
        if (set.has(value)) set.delete(value)
        else set.add(value)
        if (set.size) p.set(group, [...set].join(','))
        else p.delete(group)
      }),
    clearFilters: () => update((p) => FILTER_GROUPS.forEach((g) => p.delete(g.key))),
  }
}
