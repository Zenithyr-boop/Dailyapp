import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { ChevronRightIcon } from '../../components/icons'
import type { Day } from '../../lib/db'
import { evaluateProgram } from './progress'
import { getActiveProgram } from './programsRepo'

/** One line above the quests: the running program and its day ("Day 12 of 66"). Links to Programs. */
export function ProgramStrip({ today, byDate }: { today: string; byDate: ReadonlyMap<string, Day> }) {
  const program = useLiveQuery(getActiveProgram, [])
  if (!program) return null
  const p = evaluateProgram(program, (d) => byDate.get(d), today)
  return (
    <Link
      to="/programs"
      className="flex min-h-touch items-center gap-3 border border-panel-edge bg-panel px-4 py-2 hover:border-accent"
    >
      <span className="label text-accent">{program.name}</span>
      <span className="flex-1 font-display text-lg font-bold tabular-nums">
        Day {p.dayNumber} <span className="text-muted">of {program.length}</span>
      </span>
      {program.strict && <span className="label hidden sm:inline">Strict</span>}
      <ChevronRightIcon size={18} className="text-faint" />
    </Link>
  )
}
