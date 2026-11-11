import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { ChevronRightIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { useToday } from '../../lib/day'
import type { ProgramAttempt, ProgramState } from '../../lib/db'
import { useUnits } from '../profile/units'
import { useQuestDays } from '../quests/questDays'
import { listQuestDefs } from '../quests/questsRepo'
import { ProgramBadgeMark, ProgramCompleteDialog } from './ProgramCompleteDialog'
import { evaluateProgram, type ProgramProgress } from './progress'
import { dismissProgramCelebration, endProgram, getProgramCelebration, usePrograms } from './programsRepo'
import { programBonus, TEMPLATES } from './templates'
import { formatFull, formatShort, ruleSummary } from './format'
import { GridLegend, ProgramGrid } from './ui'

const fmt = new Intl.NumberFormat()

export function ProgramsPage() {
  const today = useToday()
  const programs = usePrograms()
  const qd = useQuestDays(today)
  const celebration = useLiveQuery(getProgramCelebration, [])

  if (!programs || !qd) return <p className="text-muted">Loading programs…</p>

  const active = programs.find((p) => p.status === 'active')
  const progress = active && evaluateProgram(active, (d) => qd.byDate.get(d), today)
  const past = programs.filter((p) => p.status !== 'active')

  return (
    <>
      <PageHeader title="Programs" kicker="One at a time" />
      <div className="space-y-4">
        {active && progress && <ActiveProgram program={active} progress={progress} />}

        <Panel title={active ? 'Programs' : 'Start a program'}>
          {active && (
            <p className="mb-3 text-sm text-muted">
              One program at a time. End {active.name} to start another.
            </p>
          )}
          <ul className="-my-1 grid gap-3 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <li key={t.id} className="flex flex-col border border-line p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-2xl font-extrabold leading-none">{t.name}</h3>
                  <span className="label shrink-0">{t.custom ? 'Your rules' : `${t.length} days`}</span>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">{t.blurb}</p>
                <p className="mt-3 text-xs text-muted">
                  {t.custom ? 'Finish for up to +2,000 XP' : `Finish for +${fmt.format(programBonus(t.length))} XP`} and a badge.
                  {t.strict && ' Strict by default.'}
                </p>
                {active ? (
                  <span className="mt-3 inline-flex min-h-touch items-center justify-center border border-line font-display font-bold uppercase tracking-wider text-faint">
                    Set up
                  </span>
                ) : (
                  <Link
                    to={`/programs/new/${t.id}`}
                    className="mt-3 inline-flex min-h-touch items-center justify-center gap-1 bg-accent font-display font-bold uppercase tracking-wider text-on-accent hover:bg-text"
                  >
                    Set up <ChevronRightIcon size={18} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        {past.length > 0 && <PastPrograms programs={past} />}
      </div>

      {celebration && <ProgramCompleteDialog celebration={celebration} onClose={dismissProgramCelebration} />}
    </>
  )
}

function ActiveProgram({ program, progress }: { program: ProgramState; progress: ProgramProgress }) {
  const units = useUnits()
  const rules = useLiveQuery(async () => (await listQuestDefs()).filter((q) => q.programId === program.id), [program.id])
  const [confirmEnd, setConfirmEnd] = useState(false)
  const attempts = [...program.attempts, ...progress.newAttempts]

  return (
    <>
      <Panel title={program.name} aside={program.strict ? 'Strict · a miss restarts' : 'A miss is marked, not a restart'}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="font-display font-extrabold leading-none">
            <span className="text-[56px] tabular-nums">Day {progress.dayNumber}</span>{' '}
            <span className="ml-1 text-2xl text-muted">of {program.length}</span>
          </p>
          <dl className="flex gap-6 text-right">
            <Stat label="Done" value={progress.daysDone} />
            {!program.strict && <Stat label="Missed" value={progress.missed} />}
            {program.strict && <Stat label="Attempt" value={attempts.length + 1} />}
          </dl>
        </div>
        <p className="mt-1 text-sm text-muted">
          Started {formatFull(progress.startDate)} · last day {formatFull(progress.lastDate)} · finish for +
          {fmt.format(programBonus(program.length))} XP and a badge
        </p>

        <div className="mt-5">
          <ProgramGrid days={progress.days} length={program.length} />
        </div>
        <div className="mt-3">
          <GridLegend strict={program.strict} />
        </div>

        <h3 className="label mt-6">Daily rules</h3>
        <p className="mt-1 text-sm text-muted">
          They’re in your daily quests, tagged {program.name}. A day counts when every rule is done; yesterday stays open until today
          resets.
        </p>
        <ul className="mt-2">
          {(rules ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted">{ruleSummary(r, units)}</p>
              </div>
              <span className="font-display font-semibold tabular-nums text-accent">+{r.xp}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/quests"
            className="inline-flex min-h-touch items-center justify-center bg-accent px-5 font-display font-bold uppercase tracking-wider text-on-accent hover:bg-text"
          >
            Today’s quests
          </Link>
          {!confirmEnd && (
            <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
              End program
            </Button>
          )}
        </div>
        {confirmEnd && (
          <div className="mt-4 border border-line p-4">
            <p>
              End <strong>{program.name}</strong> on day {progress.dayNumber}? Its rules leave your quests from today, including today’s
              ticks on them. Quests you already had go back to how they were. The attempt stays on record.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void endProgram(program.id)}>End program</Button>
              <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
                Keep going
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {attempts.length > 0 && (
        <Panel title="Past attempts" aside={`${attempts.length}`}>
          <AttemptList attempts={attempts} length={program.length} />
        </Panel>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="font-display text-3xl font-bold leading-none tabular-nums">{value}</dd>
    </div>
  )
}

const END_TEXT: Record<ProgramAttempt['end'], string> = { missed: 'Missed', ended: 'Ended', finished: 'Finished' }

function AttemptList({ attempts, length }: { attempts: readonly ProgramAttempt[]; length: number }) {
  return (
    <ol className="-my-2">
      {[...attempts].reverse().map((a, i) => (
        <li key={`${a.startDate}-${i}`} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
          <span className="label w-8 shrink-0">#{attempts.length - i}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {formatShort(a.startDate)} – {formatShort(a.endDate)}
            </p>
            <p className="text-xs text-muted">{END_TEXT[a.end]}</p>
          </div>
          <span className="font-display font-semibold tabular-nums">
            {a.daysDone}/{length} days
          </span>
        </li>
      ))}
    </ol>
  )
}

function PastPrograms({ programs }: { programs: readonly ProgramState[] }) {
  return (
    <Panel title="Past programs">
      <ul className="-my-2">
        {programs.map((p) => (
          <li key={p.id} className="border-b border-line-soft py-3 last:border-b-0">
            <div className="flex items-center gap-3">
              {p.status === 'finished' ? (
                <ProgramBadgeMark />
              ) : (
                <span aria-hidden="true" className="size-11 shrink-0 border-2 border-line" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold uppercase leading-tight">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.status === 'finished'
                    ? `Finished ${p.endDate ? formatFull(p.endDate) : ''} · ${p.daysDone ?? p.length}/${p.length} days`
                    : `Ended ${p.endDate ? formatFull(p.endDate) : ''}`}
                  {p.strict ? ' · strict' : ''}
                </p>
              </div>
              {p.status === 'finished' && p.bonusXp ? (
                <span className="font-display font-semibold tabular-nums text-rank">+{fmt.format(p.bonusXp)} XP</span>
              ) : null}
            </div>
            {p.attempts.length > 1 && (
              <details className="mt-2">
                <summary className="flex min-h-touch cursor-pointer items-center text-sm text-accent">
                  {p.attempts.length} attempts
                </summary>
                <AttemptList attempts={p.attempts} length={p.length} />
              </details>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
