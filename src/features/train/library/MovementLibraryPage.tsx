import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, SearchIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { CATEGORIES, EQUIPMENT, label, MUSCLES } from './catalog'
import { Chip, Tag } from './Chip'
import { COACH_PICKS } from './coachPicks'
import { indexMovement, searchMovements, type MovementFilters } from './search'
import type { Movement } from './types'
import { useMovements } from './useMovements'

const PAGE = 40
const PICKS = new Set(COACH_PICKS)

const GROUPS = [
  { key: 'muscle', title: 'Muscle', values: MUSCLES },
  { key: 'equipment', title: 'Equipment', values: EQUIPMENT },
  { key: 'category', title: 'Category', values: CATEGORIES },
] as const
type GroupKey = (typeof GROUPS)[number]['key']

function readSet(params: URLSearchParams, key: GroupKey): Set<string> {
  return new Set((params.get(key) ?? '').split(',').filter(Boolean))
}

/** Browse and search the movement library. Query and filters live in the URL, so Back keeps them. */
export function MovementLibraryPage() {
  const { movements, error, retry } = useMovements()
  const [params, setParams] = useSearchParams()
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null)

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
  const filterCount = selected.muscle.size + selected.equipment.size + selected.category.size
  const browsing = deferredQuery.trim() === '' && filterCount === 0

  const index = useMemo(() => movements?.map(indexMovement), [movements])
  const results = useMemo(
    () => (index ? searchMovements(index, deferredQuery, filters, COACH_PICKS) : undefined),
    [index, deferredQuery, filters],
  )

  function update(change: (p: URLSearchParams) => void) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        change(next)
        return next
      },
      { replace: true },
    )
  }

  function setQuery(value: string) {
    update((p) => (value ? p.set('q', value) : p.delete('q')))
  }

  function toggle(group: GroupKey, value: string) {
    update((p) => {
      const set = readSet(p, group)
      if (set.has(value)) set.delete(value)
      else set.add(value)
      if (set.size) p.set(group, [...set].join(','))
      else p.delete(group)
    })
  }

  function clearFilters() {
    update((p) => GROUPS.forEach((g) => p.delete(g.key)))
  }

  return (
    <>
      <Link
        to="/train"
        className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
      >
        <ChevronLeftIcon size={18} />
        Train
      </Link>
      <PageHeader
        title="Movements"
        aside={
          <Link
            to="/train/movements/new"
            className="inline-flex min-h-touch items-center gap-2 border border-panel-edge px-4 font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
          >
            <PlusIcon size={18} />
            New
          </Link>
        }
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="movement-search" className="sr-only">
            Search movements
          </label>
          <div className="flex min-h-touch items-center border border-line bg-panel focus-within:border-accent">
            <SearchIcon size={20} className="ml-3 shrink-0 text-muted" />
            <input
              id="movement-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movements"
              autoComplete="off"
              spellCheck={false}
              className="min-h-touch w-full min-w-0 bg-transparent px-3 text-text placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="grid size-11 shrink-0 place-items-center text-muted hover:text-text"
              >
                <CloseIcon size={18} />
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Filters">
            {GROUPS.map((g) => {
              const count = selected[g.key].size
              const open = openGroup === g.key
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-expanded={open}
                  aria-controls={`filter-${g.key}`}
                  onClick={() => setOpenGroup(open ? null : g.key)}
                  className={`flex min-h-touch items-center justify-center gap-1.5 border px-2 font-display text-sm font-semibold uppercase tracking-wider ${
                    open ? 'border-accent text-accent' : count ? 'border-panel-edge text-text' : 'border-line text-muted hover:text-text'
                  }`}
                >
                  {g.title}
                  {count > 0 && (
                    <span className="bg-accent px-1.5 text-xs leading-5 text-on-accent" aria-label={`${count} selected`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {GROUPS.map(
            (g) =>
              openGroup === g.key && (
                <div key={g.key} id={`filter-${g.key}`} className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={g.title}>
                  {g.values.map((v) => (
                    <Chip key={v} selected={selected[g.key].has(v)} onClick={() => toggle(g.key, v)}>
                      {label(v)}
                    </Chip>
                  ))}
                </div>
              ),
          )}
          {filterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 min-h-touch font-display text-sm font-semibold uppercase tracking-wider text-accent hover:text-text"
            >
              Clear filters ({filterCount})
            </button>
          )}
        </div>

        {error ? (
          <Panel title="Movements">
            <p className="text-muted">Couldn’t load the movement library. Check your connection and try again.</p>
            <Button variant="secondary" className="mt-3" onClick={retry}>
              Retry
            </Button>
          </Panel>
        ) : !results ? (
          <Panel title="Movements">
            <p className="text-muted" role="status">
              Loading movements…
            </p>
          </Panel>
        ) : browsing ? (
          <BrowseSections movements={results} />
        ) : results.length ? (
          <MovementList key={`${deferredQuery}|${params.toString()}`} title="Results" movements={results} paged />
        ) : (
          <Panel title="Results" aside="0 found">
            <p className="text-muted">No movements match. Check the spelling or clear a filter.</p>
            {query.trim() && (
              <Link
                to={`/train/movements/new?name=${encodeURIComponent(query.trim())}`}
                className="mt-3 inline-flex min-h-touch items-center gap-2 border border-panel-edge px-4 font-display font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
              >
                <PlusIcon size={18} />
                Create “{query.trim()}”
              </Link>
            )}
          </Panel>
        )}
      </div>
    </>
  )
}

function BrowseSections({ movements }: { movements: Movement[] }) {
  const picks = movements.filter((m) => PICKS.has(m.id))
  const custom = movements.filter((m) => m.source === 'custom')
  const rest = movements.filter((m) => !PICKS.has(m.id) && m.source !== 'custom')
  return (
    <>
      <MovementList title="Coach's picks" movements={picks} hidePickTag />
      {custom.length > 0 && <MovementList title="Your movements" movements={custom} />}
      <MovementList title="All movements A–Z" movements={rest} paged />
    </>
  )
}

function MovementList({
  title,
  movements,
  paged = false,
  hidePickTag = false,
}: {
  title: string
  movements: Movement[]
  paged?: boolean
  hidePickTag?: boolean
}) {
  const [shown, setShown] = useState(PAGE)
  const visible = paged ? movements.slice(0, shown) : movements
  const left = movements.length - visible.length
  return (
    <Panel title={title} aside={`${movements.length}`}>
      <ul className="-mx-4 -my-4">
        {visible.map((m) => (
          <li key={m.id} className="border-b border-line-soft last:border-b-0">
            <MovementRow movement={m} showPickTag={!hidePickTag} />
          </li>
        ))}
      </ul>
      {left > 0 && (
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, left)} more
        </Button>
      )}
    </Panel>
  )
}

function MovementRow({ movement: m, showPickTag }: { movement: Movement; showPickTag: boolean }) {
  const details = [m.primaryMuscles.map(label).join(', '), label(m.equipment)].filter(Boolean).join(' · ')
  return (
    <Link to={`/train/movements/${encodeURIComponent(m.id)}`} className="group flex min-h-touch items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug group-hover:text-accent">{m.name}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{details}</span>
      </span>
      {m.source === 'custom' ? <Tag>Custom</Tag> : showPickTag && PICKS.has(m.id) ? <Tag tone="accent">Pick</Tag> : null}
      <ChevronRightIcon size={18} className="shrink-0 text-faint group-hover:text-accent" />
    </Link>
  )
}
