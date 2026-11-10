/**
 * Me → Goals (`/me/goals`): everything onboarding asked, editable in one place,
 * with targets recalculating as you type. "Set my own numbers" switches to
 * custom calories and macros. Edits stay in a draft until Save.
 */
import { useEffect, useId, useState } from 'react'
import { Link, useBlocker } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { ChevronLeftIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { db } from '../../../lib/db'
import type { UnitSystem } from '../../../lib/units'
import { NumberField } from '../../train/workouts/fields'
import { CALORIE_FLOOR, DEFAULT_RATE_KG } from './coachTargets'
import {
  BirthYearInput,
  ChoiceGroup,
  Field,
  HeightInput,
  NameInput,
  Note,
  RateChoice,
  TargetsSummary,
  WeightInput,
} from './fields'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, HEIGHT_UNIT_OPTIONS, SEX_OPTIONS, WEIGHT_UNIT_OPTIONS } from './options'
import { saveGoalSettings, settingsFrom, settingsKey, useProfile, type GoalSettings } from './goalsRepo'
import { calculateTargets, kcalFromMacros } from './targets'

const ML_PER_OZ = 29.5735

export function GoalsPage() {
  const id = useId()
  const profile = useProfile()
  const [draft, setDraft] = useState<GoalSettings>()
  const [baseline, setBaseline] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number>()

  // Start the draft from the profile once it has loaded.
  if (profile && !draft) {
    const s = settingsFrom(profile)
    setDraft(s)
    setBaseline(settingsKey(s))
  }

  const dirty = !!draft && settingsKey(draft) !== baseline
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!draft) {
    return (
      <>
        <Header />
        <p className="text-muted">Loading…</p>
      </>
    )
  }

  const d = draft
  const set = (patch: Partial<GoalSettings>) => setDraft({ ...d, ...patch })
  const setBody = (patch: Partial<GoalSettings['body']>) => set({ body: { ...d.body, ...patch } })
  const setGoals = (patch: Partial<GoalSettings['goals']>) => set({ goals: { ...d.goals, ...patch } })

  const calculated = calculateTargets(d.body, d.plan)
  const custom = d.goals.macroMode === 'custom'

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await saveGoalSettings(d)
      const fresh = await db.profile.get('me')
      if (fresh) {
        const s = settingsFrom(fresh)
        setDraft(s)
        setBaseline(settingsKey(s))
      }
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (!profile) return
    const s = settingsFrom(profile)
    setDraft(s)
    setBaseline(settingsKey(s))
  }

  function switchMacroMode(on: boolean) {
    if (!on) return setGoals({ macroMode: 'auto' })
    // Start from the calculated numbers (or what was saved before).
    const from = calculated ?? d.goals
    setGoals({
      macroMode: 'custom',
      kcal: from.kcal ?? 2000,
      proteinG: from.proteinG ?? 150,
      carbsG: from.carbsG ?? 200,
      fatG: from.fatG ?? 70,
    })
  }

  const sex = d.body.sex ?? 'unspecified'
  const macroKcal = kcalFromMacros({ proteinG: d.goals.proteinG ?? 0, carbsG: d.goals.carbsG ?? 0, fatG: d.goals.fatG ?? 0 })

  return (
    <>
      <Header />
      <div className="space-y-4 pb-4">
        <Panel title="Profile">
          <div className="space-y-5">
            <Field label="Name" htmlFor={`${id}-name`}>
              <NameInput id={`${id}-name`} value={d.displayName} onChange={(displayName) => set({ displayName })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <ChoiceGroup legend="Weight" options={WEIGHT_UNIT_OPTIONS} value={d.units} columns={2} onChange={(units) => set({ units })} />
              <ChoiceGroup legend="Height" options={HEIGHT_UNIT_OPTIONS} value={d.heightUnits} columns={2} onChange={(heightUnits) => set({ heightUnits })} />
            </div>
          </div>
        </Panel>

        <Panel title="Body">
          <div className="space-y-5">
            <ChoiceGroup legend="Sex" options={SEX_OPTIONS} value={d.body.sex} columns={3} onChange={(s) => setBody({ sex: s })} />
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Birth year" htmlFor={`${id}-year`}>
                <BirthYearInput id={`${id}-year`} value={d.body.birthYear} onChange={(birthYear) => setBody({ birthYear })} />
              </Field>
              <Field label="Height" htmlFor={`${id}-height`}>
                <HeightInput id={`${id}-height`} cm={d.body.heightCm} units={d.heightUnits} onChange={(heightCm) => setBody({ heightCm })} />
              </Field>
              <Field label="Weight" htmlFor={`${id}-weight`}>
                <WeightInput id={`${id}-weight`} kg={d.body.weightKg} units={d.units} onChange={(weightKg) => setBody({ weightKg })} />
              </Field>
            </div>
            <ChoiceGroup legend="Activity" options={ACTIVITY_OPTIONS} value={d.body.activity} onChange={(activity) => setBody({ activity })} />
          </div>
        </Panel>

        <Panel title="Goal">
          <div className="space-y-5">
            <ChoiceGroup
              legend="Goal"
              options={GOAL_OPTIONS}
              value={d.plan.goal}
              columns={3}
              onChange={(goal) => set({ plan: { goal, rateKgPerWeek: DEFAULT_RATE_KG[goal] } })}
            />
            {d.plan.goal !== 'maintain' && (
              <RateChoice
                goal={d.plan.goal}
                units={d.units}
                weightKg={d.body.weightKg}
                rateKg={d.plan.rateKgPerWeek}
                onChange={(rateKgPerWeek) => set({ plan: { ...d.plan, rateKgPerWeek } })}
                legend="Weekly rate"
              />
            )}
          </div>
        </Panel>

        <Panel title="Daily targets" aside={custom ? 'Your numbers' : 'Calculated'}>
          <div className="space-y-5">
            <ChoiceGroup
              legend="Targets"
              options={[
                { value: 'auto', label: 'Calculate for me' },
                { value: 'custom', label: 'Set my own numbers' },
              ]}
              value={custom ? 'custom' : 'auto'}
              columns={2}
              onChange={(v) => switchMacroMode(v === 'custom')}
            />
            {!custom &&
              (calculated ? (
                <TargetsSummary result={calculated} goal={d.plan.goal} units={d.units} />
              ) : (
                <p className="text-muted">Add your birth year, height, weight and activity to calculate calories and macros.</p>
              ))}
            {custom && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MacroField id={`${id}-kcal`} label="Calories (kcal)" value={d.goals.kcal} min={800} max={8000} onChange={(kcal) => setGoals({ kcal })} />
                  <MacroField id={`${id}-protein`} label="Protein (g)" value={d.goals.proteinG} min={0} max={500} onChange={(proteinG) => setGoals({ proteinG })} />
                  <MacroField id={`${id}-carbs`} label="Carbs (g)" value={d.goals.carbsG} min={0} max={1000} onChange={(carbsG) => setGoals({ carbsG })} />
                  <MacroField id={`${id}-fat`} label="Fat (g)" value={d.goals.fatG} min={0} max={400} onChange={(fatG) => setGoals({ fatG })} />
                </div>
                <p className="text-sm text-muted" aria-live="polite">
                  Your macros add up to {new Intl.NumberFormat().format(macroKcal)} kcal
                  {d.goals.kcal !== undefined && Math.abs(macroKcal - d.goals.kcal) > 50 && ` (${macroKcal > d.goals.kcal ? 'over' : 'under'} your calorie target)`}.
                  {calculated && ` Calculated would be ${new Intl.NumberFormat().format(calculated.kcal)} kcal.`}
                </p>
                {d.goals.kcal !== undefined && d.goals.kcal < CALORIE_FLOOR[sex] && (
                  <Note>
                    That’s below {new Intl.NumberFormat().format(CALORIE_FLOOR[sex])} kcal, the lowest we’d ever calculate. If it’s
                    what your coach or doctor set, go for it; otherwise eating this little is hard to sustain and can cost muscle.
                  </Note>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Other daily goals" aside="Optional">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Steps" htmlFor={`${id}-steps`}>
              <NumberField id={`${id}-steps`} value={d.goals.steps} onChange={(steps) => setGoals({ steps })} min={1000} max={50000} optional placeholder="8000" />
            </Field>
            <Field label="Sleep (hours)" htmlFor={`${id}-sleep`}>
              <NumberField id={`${id}-sleep`} value={d.goals.sleepHours} onChange={(sleepHours) => setGoals({ sleepHours })} min={4} max={12} precision={1} optional placeholder="8" />
            </Field>
            <Field label={d.units === 'metric' ? 'Water (L)' : 'Water (oz)'} htmlFor={`${id}-water`}>
              <WaterInput id={`${id}-water`} ml={d.goals.waterMl} units={d.units} onChange={(waterMl) => setGoals({ waterMl })} />
            </Field>
          </div>
        </Panel>
      </div>

      {(dirty || savedAt) && (
        <div className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center justify-end gap-2 border-t border-panel-edge bg-panel px-4 py-2 md:bottom-0 md:mx-0">
          <p className="mr-auto text-sm text-muted" role="status">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </p>
          {dirty && (
            <>
              <Button variant="secondary" disabled={saving} onClick={discard}>
                Discard
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                Save
              </Button>
            </>
          )}
        </div>
      )}

      {blocker.state === 'blocked' && (
        <Dialog title="Save your goals?" onClose={() => blocker.reset()}>
          <p>You have unsaved changes to your goals.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await save()
                blocker.proceed()
              }}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => blocker.proceed()}>
              Discard
            </Button>
            <Button variant="secondary" onClick={() => blocker.reset()}>
              Keep editing
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function Header() {
  return (
    <PageHeader
      title="Goals"
      kicker="Me"
      aside={
        <Link to="/me" className="inline-flex min-h-touch items-center gap-1 pr-1 font-display font-bold uppercase tracking-wider text-accent">
          <ChevronLeftIcon size={20} />
          Me
        </Link>
      }
    />
  )
}

function MacroField(props: { id: string; label: string; value: number | undefined; min: number; max: number; onChange: (v: number | undefined) => void }) {
  return (
    <Field label={props.label} htmlFor={props.id}>
      <NumberField id={props.id} value={props.value} onChange={props.onChange} min={props.min} max={props.max} optional />
    </Field>
  )
}

/** Water goal in litres or fluid ounces; stored as ml. */
function WaterInput({ id, ml, units, onChange }: { id: string; ml: number | undefined; units: UnitSystem; onChange: (ml: number | undefined) => void }) {
  const metric = units === 'metric'
  const shown = ml === undefined ? undefined : metric ? Math.round(ml / 100) / 10 : Math.round(ml / ML_PER_OZ)
  return (
    <NumberField
      key={units}
      id={id}
      value={shown}
      onChange={(v) => onChange(v === undefined ? undefined : Math.round(metric ? v * 1000 : v * ML_PER_OZ))}
      min={metric ? 0.5 : 16}
      max={metric ? 8 : 270}
      precision={metric ? 1 : 0}
      optional
      placeholder={metric ? '3' : '100'}
    />
  )
}
