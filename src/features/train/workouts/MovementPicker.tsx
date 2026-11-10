import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../../../components/Button'
import { CloseIcon } from '../../../components/icons'
import { Panel } from '../../../components/Panel'
import { label } from '../library/catalog'
import { Tag } from '../library/Chip'
import { COACH_PICKS } from '../library/coachPicks'
import { indexMovement, searchMovements } from '../library/search'
import { SearchControls } from '../library/SearchControls'
import type { Movement } from '../library/types'
import { useMovementSearch } from '../library/useMovementSearch'

const PAGE = 40
const PICKS = new Set(COACH_PICKS)

interface MovementPickerProps {
  movements: Movement[] | undefined
  error: boolean
  retry: () => void
  /** Movements already in the workout (tagged, still addable). */
  inWorkout: ReadonlySet<string>
  onAdd: (ids: string[]) => void
  onClose: () => void
}

/**
 * Full-screen picker over the builder: the library's search and filters,
 * tick one or more movements, add them in the order ticked.
 */
export function MovementPicker({ movements, error, retry, inWorkout, onAdd, onClose }: MovementPickerProps) {
  const titleId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const search = useMovementSearch()
  const { deferredQuery, filters, filterCount } = search
  const [picked, setPicked] = useState<string[]>([])
  const [shown, setShown] = useState(PAGE)
  const [resultsKey, setResultsKey] = useState('')

  const index = useMemo(() => movements?.map(indexMovement), [movements])
  const results = useMemo(
    () => (index ? searchMovements(index, deferredQuery, filters, COACH_PICKS) : undefined),
    [index, deferredQuery, filters],
  )
  // A new search starts from the first page again.
  const key = `${deferredQuery}|${filterCount}|${[...filters.muscles, ...filters.equipment, ...filters.categories].join(',')}`
  if (key !== resultsKey) {
    setResultsKey(key)
    setShown(PAGE)
  }
  const visible = results?.slice(0, shown)
  const browsing = deferredQuery.trim() === '' && filterCount === 0

  // Lock the page behind and move focus into the picker; Esc closes it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    boxRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-bg"
    >
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-3xl font-extrabold leading-none">
            Add movements
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-touch place-items-center border border-line text-muted hover:border-accent hover:text-accent"
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="space-y-4">
          <SearchControls search={search} inputId="picker-search" />

          {error ? (
            <Panel title="Movements">
              <p className="text-muted">Couldn’t load the movement library. Check your connection and try again.</p>
              <Button variant="secondary" className="mt-3" onClick={retry}>
                Retry
              </Button>
            </Panel>
          ) : !results || !visible ? (
            <Panel title="Movements">
              <p className="text-muted" role="status">
                Loading movements…
              </p>
            </Panel>
          ) : results.length === 0 ? (
            <Panel title="Results" aside="0 found">
              <p className="text-muted">No movements match. Check the spelling or clear a filter.</p>
            </Panel>
          ) : (
            <Panel title={browsing ? "Coach's picks first" : 'Results'} aside={`${results.length}`}>
              <ul className="-mx-4 -my-4">
                {visible.map((m) => {
                  const order = picked.indexOf(m.id)
                  const details = [m.primaryMuscles.map(label).join(', '), label(m.equipment)].filter(Boolean).join(' · ')
                  return (
                    <li key={m.id} className="border-b border-line-soft last:border-b-0">
                      <label className="group flex min-h-touch cursor-pointer items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={order >= 0}
                          onChange={() => toggle(m.id)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`grid size-6 shrink-0 place-items-center border font-display text-sm font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                            order >= 0 ? 'border-accent bg-accent text-on-accent' : 'border-faint'
                          }`}
                        >
                          {order >= 0 ? order + 1 : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold leading-snug group-hover:text-accent">{m.name}</span>
                          <span className="mt-0.5 block truncate text-sm text-muted">{details}</span>
                        </span>
                        {inWorkout.has(m.id) ? (
                          <Tag>In workout</Tag>
                        ) : m.source === 'custom' ? (
                          <Tag>Custom</Tag>
                        ) : PICKS.has(m.id) ? (
                          <Tag tone="accent">Pick</Tag>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
              {results.length > visible.length && (
                <Button variant="secondary" className="mt-6 w-full" onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, results.length - visible.length)} more
                </Button>
              )}
            </Panel>
          )}
        </div>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-panel-edge bg-panel">
        <div className="mx-auto flex w-full max-w-2xl gap-2 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={picked.length === 0} onClick={() => onAdd(picked)}>
            {picked.length === 0 ? 'Tick movements to add' : `Add ${picked.length} movement${picked.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
