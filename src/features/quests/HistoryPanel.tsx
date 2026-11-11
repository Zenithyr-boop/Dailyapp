import { Link } from 'react-router'
import { ChevronRightIcon } from '../../components/icons'
import { Panel } from '../../components/Panel'
import { fromDayKey } from '../../lib/day'
import { bestRun, type HistoryCell, type HistoryStatus } from './progress'

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const fmt = new Intl.NumberFormat()

const CELL: Record<HistoryStatus, string> = {
  full: 'bg-accent',
  partial: 'bg-accent/35',
  missed: 'bg-line',
  'before-start': 'border border-line-soft',
}

function describe(c: HistoryCell): string {
  const date = dayLabel.format(fromDayKey(c.date))
  if (c.status === 'before-start') return `${date}: before you started`
  if (c.total === 0) return `${date}: missed`
  return `${date}: ${c.done} of ${c.total} quests, ${fmt.format(c.xp)} XP`
}

/** Last 30 days as a grid of blocks, plus a few totals and a link to the full history. */
export function HistoryPanel({ cells }: { cells: HistoryCell[] }) {
  const full = cells.filter((c) => c.status === 'full').length
  const xp = cells.reduce((sum, c) => sum + c.xp, 0)
  const today = cells.at(-1)?.date

  return (
    <Panel title="Last 30 days" aside={`${full}/${cells.length} full`}>
      <ol className="grid grid-cols-10 gap-1.5" aria-label="Daily results, oldest first">
        {cells.map((c) => (
          <li
            key={c.date}
            title={describe(c)}
            className={`aspect-square ${CELL[c.status]} ${c.date === today ? 'outline-2 outline-offset-2 outline-muted' : ''}`}
          >
            <span className="sr-only">{describe(c)}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 bg-accent" /> All done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 bg-accent/35" /> Some done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 bg-line" /> Missed
        </li>
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line-soft pt-4">
        <Stat label="Full days" value={full} />
        <Stat label="XP earned" value={fmt.format(xp)} />
        <Stat label="Best streak" value={bestRun(cells)} />
      </dl>
      <Link
        to="/quests/history"
        className="group -mx-4 -mb-4 mt-4 flex min-h-touch items-center justify-between border-t border-line-soft px-4 font-display text-sm font-bold uppercase tracking-wider hover:text-accent"
      >
        Day history
        <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
      </Link>
    </Panel>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl font-bold leading-none tabular-nums">{value}</dd>
    </div>
  )
}
