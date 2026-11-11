import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { ChevronLeftIcon, EditIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import type { QuestFields } from '../../lib/db'
import { useUnits } from '../profile/units'
import { QuestForm } from '../quests/QuestForm'
import { listQuestDefs, normalizeFields } from '../quests/questsRepo'
import { getActiveProgram, startProgram } from './programsRepo'
import { clampLength, programBonus, PROGRAM_LENGTH_MAX, PROGRAM_LENGTH_MIN, PROGRAM_RULES_MAX, templateById, type ProgramTemplate } from './templates'
import { ruleSummary } from './format'

const fmt = new Intl.NumberFormat()
const inputClass =
  'mt-1 block min-h-touch w-full border border-line bg-bg px-3 text-text placeholder:text-faint focus:border-accent focus:outline-none'

const sameRule = (a: QuestFields, b: QuestFields) =>
  a.link || b.link ? a.link?.source === b.link?.source : a.kind === b.kind && a.title.trim().toLowerCase() === b.title.trim().toLowerCase()

/** Set up a program from a template, then start it (day 1 = today). */
export function ProgramBuilderPage() {
  const { template: templateId } = useParams()
  const template = templateById(templateId)
  if (!template) {
    return (
      <>
        <PageHeader title="Programs" />
        <p className="text-muted">
          That program doesn’t exist.{' '}
          <Link to="/programs" className="text-accent underline">
            Back to Programs
          </Link>
        </p>
      </>
    )
  }
  return <Builder key={template.id} template={template} />
}

function Builder({ template }: { template: ProgramTemplate }) {
  const navigate = useNavigate()
  const units = useUnits()
  const ids = useId()
  const active = useLiveQuery(async () => (await getActiveProgram()) ?? null, [])
  const quests = useLiveQuery(async () => (await listQuestDefs()).filter((q) => !q.programId), [])

  const [name, setName] = useState(template.custom ? '' : template.name)
  const [length, setLength] = useState(String(template.length))
  const [strict, setStrict] = useState(template.strict)
  /** Picked quests (by id) and ideas (by title). */
  const [pickedQuests, setPickedQuests] = useState<ReadonlySet<string>>(new Set())
  const [pickedIdeas, setPickedIdeas] = useState<ReadonlySet<string>>(new Set())
  /** Rules written here. */
  const [extra, setExtra] = useState<QuestFields[]>([])
  /** Index of the rule being edited, 'new', or null. */
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fixed = useMemo(() => template.rules(units), [template, units])
  // Ideas the user already has as a quest are left out (pick the quest instead).
  const ideas = useMemo(
    () => (quests ? (template.suggestions?.(units) ?? []).filter((s) => !quests.some((q) => sameRule(q, s))) : []),
    [template, units, quests],
  )

  const rules: QuestFields[] = template.editableRules
    ? [
        ...(quests ?? []).filter((q) => pickedQuests.has(q.id)).map(normalizeFields),
        ...ideas.filter((s) => pickedIdeas.has(s.title)),
        ...extra,
      ]
    : fixed
  const days = template.custom ? clampLength(Number(length)) : template.length
  const tooMany = rules.length > PROGRAM_RULES_MAX
  const lengthInvalid = template.custom && (length === '' || Number(length) < PROGRAM_LENGTH_MIN || Number(length) > PROGRAM_LENGTH_MAX)
  const canStart = !active && rules.length > 0 && !tooMany && !lengthInvalid && (!template.custom || name.trim() !== '') && !busy

  const toggle = <T,>(set: ReadonlySet<T>, value: T) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  async function start() {
    setBusy(true)
    setError('')
    try {
      await startProgram({ kind: template.id, name: template.custom ? name : template.name, length: days, strict, rules })
      navigate('/programs', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t start the program')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={template.custom ? 'Custom program' : template.name}
        kicker="Set up"
        aside={
          <Link to="/programs" className="inline-flex min-h-touch items-center gap-1 pr-1 font-display font-bold uppercase tracking-wider text-accent">
            <ChevronLeftIcon size={20} />
            Cancel
          </Link>
        }
      />

      <div className="space-y-4">
        {active && (
          <Panel title="One program at a time">
            <p className="text-muted">
              {active.name} is running. End it on{' '}
              <Link to="/programs" className="text-accent underline underline-offset-2">
                Programs
              </Link>{' '}
              before starting another.
            </p>
          </Panel>
        )}

        <Panel title="The program">
          <p className="text-muted">{template.blurb}</p>
          {template.custom && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div>
                <label htmlFor={`${ids}-name`} className="label">
                  Name
                </label>
                <input id={`${ids}-name`} className={inputClass} value={name} maxLength={40} placeholder="e.g. 30-day cut" onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${ids}-len`} className="label">
                  Length (days)
                </label>
                <input
                  id={`${ids}-len`}
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={PROGRAM_LENGTH_MIN}
                  max={PROGRAM_LENGTH_MAX}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  aria-describedby={`${ids}-len-hint`}
                />
                <p id={`${ids}-len-hint`} className={`mt-1 text-xs ${lengthInvalid ? 'text-text' : 'text-muted'}`}>
                  {PROGRAM_LENGTH_MIN}–{PROGRAM_LENGTH_MAX} days
                </p>
              </div>
            </div>
          )}

          {template.strictChoice ? (
            <CheckRow
              checked={strict}
              onChange={setStrict}
              title="Strict mode"
              sub="Miss any rule and the program restarts at day 1. Past attempts are kept."
            />
          ) : (
            <p className="mt-4 text-sm text-muted">A missed day is marked on the grid but doesn’t restart the program.</p>
          )}
        </Panel>

        <Panel title="Daily rules" aside={template.editableRules ? `${rules.length} picked` : `${rules.length} rules`}>
          <p className="text-sm text-muted">
            Rules join your daily quests, tagged with the program. A quest you already have is used instead of a copy and goes back to
            how it was when the program ends.
          </p>

          {!template.editableRules ? (
            <ul className="mt-3">
              {fixed.map((r) => (
                <RuleLine key={r.title} rule={r} units={units} />
              ))}
            </ul>
          ) : (
            <>
              {quests && quests.length > 0 && (
                <>
                  <h3 className="label mt-5">Your quests</h3>
                  <ul>
                    {quests.map((q) => (
                      <li key={q.id} className="border-b border-line-soft last:border-b-0">
                        <CheckRow
                          checked={pickedQuests.has(q.id)}
                          onChange={() => setPickedQuests((s) => toggle(s, q.id))}
                          title={q.title}
                          sub={ruleSummary(q, units)}
                          xp={q.xp}
                          flush
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {ideas.length > 0 && (
                <>
                  <h3 className="label mt-5">Ideas</h3>
                  <ul>
                    {ideas.map((s) => (
                      <li key={s.title} className="border-b border-line-soft last:border-b-0">
                        <CheckRow
                          checked={pickedIdeas.has(s.title)}
                          onChange={() => setPickedIdeas((set) => toggle(set, s.title))}
                          title={s.title}
                          sub={ruleSummary(s, units)}
                          xp={s.xp}
                          flush
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="label mt-5">{template.suggestions ? 'Your own' : 'New rules'}</h3>
              {extra.length > 0 && (
                <ul>
                  {extra.map((r, i) =>
                    editing === i ? (
                      <li key={i} className="border-b border-line-soft py-3">
                        <QuestForm
                          initial={r}
                          submitLabel="Save"
                          onSubmit={(fields) => {
                            setExtra((list) => list.map((x, j) => (j === i ? normalizeFields(fields) : x)))
                            setEditing(null)
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      </li>
                    ) : (
                      <RuleLine key={i} rule={r} units={units}>
                        <IconButton label={`Edit ${r.title}`} onClick={() => setEditing(i)}>
                          <EditIcon size={18} />
                        </IconButton>
                        <IconButton label={`Remove ${r.title}`} onClick={() => setExtra((list) => list.filter((_, j) => j !== i))}>
                          <TrashIcon size={18} />
                        </IconButton>
                      </RuleLine>
                    ),
                  )}
                </ul>
              )}
              {editing === 'new' ? (
                <div className="mt-3 border border-line p-4">
                  <QuestForm
                    submitLabel="Add rule"
                    onSubmit={(fields) => {
                      setExtra((list) => [...list, normalizeFields(fields)])
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <Button variant="secondary" className="mt-3 w-full" onClick={() => setEditing('new')}>
                  <PlusIcon size={20} />
                  Add a rule
                </Button>
              )}
              {tooMany && <p className="mt-2 text-sm">Up to {PROGRAM_RULES_MAX} rules.</p>}
            </>
          )}
        </Panel>

        <Panel title="Start">
          <p className="text-muted">
            Day 1 is today. {days} days{strict ? ', strict' : ''}, {rules.length} {rules.length === 1 ? 'rule' : 'rules'} a day. Finish for +
            {fmt.format(programBonus(days))} XP and a badge on your Me screen.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm">
              {error}
            </p>
          )}
          <Button className="mt-4 w-full" disabled={!canStart} onClick={() => void start()}>
            Start {template.custom ? name.trim() || 'program' : template.name}
          </Button>
          {rules.length === 0 && !active && <p className="mt-2 text-sm text-muted">Pick or add at least one rule.</p>}
        </Panel>
      </div>
    </>
  )
}

function RuleLine({ rule, units, children }: { rule: QuestFields; units: ReturnType<typeof useUnits>; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{rule.title}</p>
        <p className="text-xs text-muted">{ruleSummary(rule, units)}</p>
      </div>
      <span className="font-display font-semibold tabular-nums text-accent">+{rule.xp}</span>
      {children && <div className="flex">{children}</div>}
    </li>
  )
}

/** A square checkbox row (whole row is the hit area). */
function CheckRow({
  checked,
  onChange,
  title,
  sub,
  xp,
  flush = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  sub?: string
  xp?: number
  flush?: boolean
}) {
  const id = useId()
  return (
    <label htmlFor={id} className={`flex min-h-[52px] cursor-pointer items-center gap-3.5 py-2 ${flush ? '' : 'mt-4'}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer grid size-[26px] shrink-0 cursor-pointer appearance-none place-content-center border-2 border-faint checked:border-accent checked:bg-accent"
      />
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none -ml-[40px] size-[26px] shrink-0 stroke-on-accent p-0.5 opacity-0 peer-checked:opacity-100"
        fill="none"
        strokeWidth={3}
        strokeLinecap="square"
        aria-hidden="true"
      >
        <path d="M6.5 12.5l3.5 3.5 7.5-8" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      {xp !== undefined && <span className="font-display font-semibold tabular-nums text-accent">+{xp}</span>}
    </label>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-touch shrink-0 place-items-center text-muted hover:text-accent">
      {children}
    </button>
  )
}
