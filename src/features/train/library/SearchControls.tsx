import { useState } from 'react'
import { CloseIcon, SearchIcon } from '../../../components/icons'
import { label } from './catalog'
import { Chip } from './Chip'
import { FILTER_GROUPS, type GroupKey, type MovementSearch } from './useMovementSearch'

/** Search box plus Muscle / Equipment / Category filter chips. */
export function SearchControls({ search, inputId }: { search: MovementSearch; inputId: string }) {
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null)
  const { query, setQuery, selected, toggle, filterCount, clearFilters } = search
  return (
    <>
      <div>
        <label htmlFor={inputId} className="sr-only">
          Search movements
        </label>
        <div className="flex min-h-touch items-center border border-line bg-panel focus-within:border-accent">
          <SearchIcon size={20} className="ml-3 shrink-0 text-muted" />
          <input
            id={inputId}
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
          {FILTER_GROUPS.map((g) => {
            const count = selected[g.key].size
            const open = openGroup === g.key
            return (
              <button
                key={g.key}
                type="button"
                aria-expanded={open}
                aria-controls={`${inputId}-${g.key}`}
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
        {FILTER_GROUPS.map(
          (g) =>
            openGroup === g.key && (
              <div key={g.key} id={`${inputId}-${g.key}`} className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={g.title}>
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
    </>
  )
}
