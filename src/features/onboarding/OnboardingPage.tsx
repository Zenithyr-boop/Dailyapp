/**
 * First-run flow (`/welcome`): one question per screen, every one skippable,
 * then the calculated targets and starter quests. Answers stay in a draft
 * until the end (or "Skip setup"), then go to the profile in one write.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { CheckIcon } from '../../components/icons'
import type { QuestFields } from '../../lib/db'
import { AccountPanel } from '../profile/AccountPanel'
import { DEFAULT_RATE_KG } from '../profile/goals/coachTargets'
import {
  BirthYearInput,
  ChoiceGroup,
  HeightInput,
  NameInput,
  RateChoice,
  TargetsSummary,
  WeightInput,
} from '../profile/goals/fields'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, HEIGHT_UNIT_OPTIONS, SEX_OPTIONS, WEIGHT_UNIT_OPTIONS } from '../profile/goals/options'
import { DEFAULT_PLAN, saveGoalSettings, useProfile, type GoalSettings } from '../profile/goals/goalsRepo'
import { calculateTargets } from '../profile/goals/targets'
import { ensureSetup, setQuestList } from '../quests/questsRepo'
import { starterQuests, type StarterQuest } from './starterQuests'

type StepId = 'name' | 'units' | 'sex' | 'birthYear' | 'height' | 'weight' | 'activity' | 'goal' | 'rate' | 'targets' | 'quests'

const ALL_STEPS: readonly StepId[] = ['name', 'units', 'sex', 'birthYear', 'height', 'weight', 'activity', 'goal', 'rate', 'targets', 'quests']

const QUESTION = 'block font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text sm:text-4xl'

const EMPTY: GoalSettings = {
  displayName: '',
  units: 'metric',
  heightUnits: 'cm',
  body: {},
  plan: DEFAULT_PLAN,
  goals: {},
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  const [draft, setDraft] = useState<GoalSettings>(EMPTY)
  const [index, setIndex] = useState(0)
  const [quests, setQuests] = useState<StarterQuest[]>(() => starterQuests('metric'))
  const [busy, setBusy] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const headingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ensureSetup()
  }, [])

  // Already set up (finished here, or the account's profile arrived after signing in).
  useEffect(() => {
    if (profile?.onboarding) navigate('/quests', { replace: true })
  }, [profile?.onboarding, navigate])

  const steps = useMemo(() => ALL_STEPS.filter((s) => s !== 'rate' || draft.plan.goal !== 'maintain'), [draft.plan.goal])
  const step = steps[Math.min(index, steps.length - 1)]!
  const last = index >= steps.length - 1

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    headingRef.current?.querySelector<HTMLElement>('input, [data-question]')?.focus({ preventScroll: true })
  }, [step])

  const set = (patch: Partial<GoalSettings>) => setDraft((d) => ({ ...d, ...patch }))
  const setBody = (patch: Partial<GoalSettings['body']>) => setDraft((d) => ({ ...d, body: { ...d.body, ...patch } }))

  const targets = calculateTargets(draft.body, draft.plan)
  const answered = isAnswered(step, draft)
  const chosen = quests.filter((q) => q.on).map((q) => q.fields)

  async function finish(how: 'done' | 'skipped') {
    setBusy(true)
    try {
      if (how === 'done') await setQuestList(chosen)
      await saveGoalSettings(draft, how)
      navigate('/quests', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  function next() {
    if (last) void finish('done')
    else setIndex(index + 1)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <p className="font-display text-xl font-extrabold uppercase tracking-wider">FromZero</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish('skipped')}
          className="min-h-touch px-2 font-display font-bold uppercase tracking-wider text-muted hover:text-accent"
        >
          Skip setup
        </button>
      </header>

      <StepBlocks total={steps.length} current={index} />

      <main ref={headingRef} className="mt-8 flex-1 space-y-5">
        {step === 'name' && (
          <>
            <p className="text-muted">
              Welcome to FromZero. A few quick questions so your daily targets fit you. Skip any of them; you can change
              everything later in Me → Goals.
            </p>
            <Question id="q-name" label="What should we call you?">
              <NameInput id="q-name" value={draft.displayName} onChange={(displayName) => set({ displayName })} />
            </Question>
            <div className="border-t border-line-soft pt-4">
              {showSignIn ? (
                <AccountPanel />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSignIn(true)}
                  className="min-h-touch text-left text-muted underline underline-offset-2 hover:text-accent"
                >
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </>
        )}

        {step === 'units' && (
          <div className="space-y-6">
            <ChoiceGroup
              legend={<span data-question tabIndex={-1} className={QUESTION}>Which units?</span>}
              legendClassName=""
              options={WEIGHT_UNIT_OPTIONS}
              value={draft.units}
              columns={2}
              onChange={(units) => {
                set({ units, heightUnits: units === 'imperial' ? 'ftin' : 'cm' })
                setQuests(starterQuests(units).map((q) => ({ ...q, on: quests.find((o) => o.fields.title === q.fields.title)?.on ?? q.on })))
              }}
            />
            <ChoiceGroup
              legend="Height"
              options={HEIGHT_UNIT_OPTIONS}
              value={draft.heightUnits}
              columns={2}
              onChange={(heightUnits) => set({ heightUnits })}
            />
          </div>
        )}

        {step === 'sex' && (
          <>
            <ChoiceGroup
              legend={<span data-question tabIndex={-1} className={QUESTION}>Sex</span>}
              legendClassName=""
              options={SEX_OPTIONS}
              value={draft.body.sex}
              onChange={(sex) => setBody({ sex })}
            />
            <p className="text-sm text-muted">Only used in the calorie formula.</p>
          </>
        )}

        {step === 'birthYear' && (
          <Question id="q-year" label="What year were you born?" hint="Age changes how much energy you burn at rest.">
            <BirthYearInput id="q-year" value={draft.body.birthYear} onChange={(birthYear) => setBody({ birthYear })} />
          </Question>
        )}

        {step === 'height' && (
          <Question id="q-height" label="How tall are you?">
            <HeightInput id="q-height" cm={draft.body.heightCm} units={draft.heightUnits} onChange={(heightCm) => setBody({ heightCm })} />
          </Question>
        )}

        {step === 'weight' && (
          <Question id="q-weight" label="What do you weigh now?" hint="A rough number is fine. It only sets your targets.">
            <WeightInput id="q-weight" kg={draft.body.weightKg} units={draft.units} onChange={(weightKg) => setBody({ weightKg })} />
          </Question>
        )}

        {step === 'activity' && (
          <ChoiceGroup
            legend={<span data-question tabIndex={-1} className={QUESTION}>How active are you?</span>}
            legendClassName=""
            options={ACTIVITY_OPTIONS}
            value={draft.body.activity}
            onChange={(activity) => setBody({ activity })}
          />
        )}

        {step === 'goal' && (
          <ChoiceGroup
            legend={<span data-question tabIndex={-1} className={QUESTION}>What’s your goal?</span>}
            legendClassName=""
            options={GOAL_OPTIONS}
            value={draft.plan.goal}
            onChange={(goal) => set({ plan: { goal, rateKgPerWeek: DEFAULT_RATE_KG[goal] } })}
          />
        )}

        {step === 'rate' && draft.plan.goal !== 'maintain' && (
          <RateChoice
            goal={draft.plan.goal}
            units={draft.units}
            weightKg={draft.body.weightKg}
            rateKg={draft.plan.rateKgPerWeek}
            onChange={(rateKgPerWeek) => set({ plan: { ...draft.plan, rateKgPerWeek } })}
            legend={<span data-question tabIndex={-1} className={QUESTION}>How fast?</span>}
            legendClassName=""
          />
        )}

        {step === 'targets' && (
          <>
            <h1 data-question tabIndex={-1} className={QUESTION}>
              Your daily targets
            </h1>
            {targets ? (
              <TargetsSummary result={targets} goal={draft.plan.goal} units={draft.units} />
            ) : (
              <p className="text-muted">
                Add your birth year, height, weight and activity to get calorie and macro targets. You can do it any time
                in Me → Goals.
              </p>
            )}
            <p className="text-sm text-muted">Want different numbers? Set your own in Me → Goals.</p>
          </>
        )}

        {step === 'quests' && (
          <QuestPicker quests={quests} onChange={setQuests} />
        )}
      </main>

      <footer className="sticky bottom-0 mt-6 flex gap-2 bg-bg pt-3">
        {index > 0 && (
          <Button variant="secondary" disabled={busy} onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        )}
        <Button className="flex-1" disabled={busy || (last && chosen.length === 0)} onClick={next}>
          {last ? 'Start' : answered ? 'Next' : 'Skip'}
        </Button>
      </footer>
    </div>
  )
}

function isAnswered(step: StepId, d: GoalSettings): boolean {
  switch (step) {
    case 'name':
      return d.displayName.trim() !== ''
    case 'sex':
      return d.body.sex !== undefined
    case 'birthYear':
      return d.body.birthYear !== undefined
    case 'height':
      return d.body.heightCm !== undefined
    case 'weight':
      return d.body.weightKg !== undefined
    case 'activity':
      return d.body.activity !== undefined
    default:
      return true
  }
}

/** A text/number question: the label is the big heading. */
function Question({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <label htmlFor={id} className={QUESTION}>
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

/** Segmented progress: one flat block per step. */
function StepBlocks({ total, current }: { total: number; current: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-valuetext={`Step ${current + 1} of ${total}`}
      className="mt-3 flex gap-1"
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 ${i <= current ? 'bg-accent' : 'bg-line'}`} />
      ))}
    </div>
  )
}

function questDetail(f: QuestFields): string {
  const type = f.kind === 'count' ? `Target ${f.target} ${f.unit ?? ''}`.trim() : 'Checkbox'
  return `${type} · ${f.xp} XP`
}

function QuestPicker({ quests, onChange }: { quests: StarterQuest[]; onChange: (q: StarterQuest[]) => void }) {
  const on = quests.filter((q) => q.on)
  const xp = on.reduce((sum, q) => sum + q.fields.xp, 0)
  return (
    <fieldset className="space-y-3">
      <legend className="space-y-2">
        <span data-question tabIndex={-1} className={QUESTION}>
          Pick your daily quests
        </span>
        <span className="block text-muted">
          These reset every midnight. Finish them all for +80 XP. You can edit them any time.
        </span>
      </legend>
      <p className="label" aria-live="polite">
        {on.length} quests · {xp} XP a day
      </p>
      <ul className="border border-panel-edge bg-panel">
        {quests.map((q, i) => (
          <li key={q.fields.title} className="border-b border-line-soft last:border-b-0">
            <label className="flex min-h-touch cursor-pointer items-center gap-3 px-4 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input
                type="checkbox"
                checked={q.on}
                onChange={(e) => onChange(quests.map((o, j) => (j === i ? { ...o, on: e.target.checked } : o)))}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center border-2 ${q.on ? 'border-accent bg-accent text-on-accent' : 'border-faint'}`}
              >
                {q.on && <CheckIcon size={16} />}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{q.fields.title}</span>
                <span className="block text-sm text-muted">
                  {questDetail(q.fields)}
                  {q.hint && ` · ${q.hint}`}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {on.length === 0 && <p className="text-sm text-muted">Pick at least one quest to start.</p>}
    </fieldset>
  )
}
