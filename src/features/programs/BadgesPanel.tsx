import { Link } from 'react-router'
import { Panel } from '../../components/Panel'
import { ProgramBadgeMark } from './ProgramCompleteDialog'
import { usePrograms } from './programsRepo'
import { formatFull } from './format'

const fmt = new Intl.NumberFormat()

/** Badges for finished programs, on the Me screen. */
export function BadgesPanel() {
  const programs = usePrograms()
  if (!programs) return null
  const finished = programs.filter((p) => p.status === 'finished')

  return (
    <Panel title="Badges" aside={finished.length ? `${finished.length}` : undefined}>
      {finished.length === 0 ? (
        <p className="text-muted">
          Finish a program to earn its badge.{' '}
          <Link to="/programs" className="text-accent underline underline-offset-2">
            See programs
          </Link>
        </p>
      ) : (
        <ul className="-my-2">
          {finished.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
              <ProgramBadgeMark />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold uppercase leading-tight text-rank">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.endDate ? formatFull(p.endDate) : ''} · {p.daysDone ?? p.length}/{p.length} days{p.strict ? ' · strict' : ''}
                </p>
              </div>
              {p.bonusXp ? <span className="font-display font-semibold tabular-nums text-rank">+{fmt.format(p.bonusXp)} XP</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
