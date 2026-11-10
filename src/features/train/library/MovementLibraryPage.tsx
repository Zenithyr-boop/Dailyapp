import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { label } from './catalog'
import { Tag } from './Chip'
import { COACH_PICKS } from './coachPicks'
import { indexMovement, searchMovements } from './search'
import { SearchControls } from './SearchControls'
import type { Movement } from './types'
import { useMovements } from './useMovements'
import { useMovementSearch } from './useMovementSearch'

const PAGE = 40
const PICKS = new Set(COACH_PICKS)

/** Browse and search the movement library. Query and filters live in the URL, so Back keeps them. */
export function MovementLibraryPage() {
  const { movements, error, retry } = useMovements()
  const search = useMovementSearch()
  const { query, deferredQuery, filters, filterCount } = search
  const browsing = deferredQuery.trim() === '' && filterCount === 0

  const index = useMemo(() => movements?.map(indexMovement), [movements])
  const results = useMemo(
    () => (index ? searchMovements(index, deferredQuery, filters, COACH_PICKS) : undefined),
    [index, deferredQuery, filters],
  )

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
        <SearchControls search={search} inputId="movement-search" />

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
          <MovementList key={`${deferredQuery}|${[...filters.muscles, ...filters.equipment, ...filters.categories].join(",")}`} title="Results" movements={results} paged />
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
