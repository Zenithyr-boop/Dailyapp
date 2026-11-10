import { Link } from 'react-router'
import { ChevronRightIcon } from '../../../components/icons'
import { Panel } from '../../../components/Panel'
import { StatBlock } from '../../../components/StatBlock'
import { GOAL_OPTIONS } from './options'
import { useProfile } from './goalsRepo'
import { formatRate } from './targets'

const linkClass =
  'flex min-h-touch items-center justify-between gap-2 border-t border-line-soft pt-3 font-display font-bold uppercase tracking-wider text-accent hover:text-text'

/** Me screen summary of the user's goal and daily targets, linking to Me → Goals. */
export function GoalsPanel() {
  const profile = useProfile()
  if (!profile) return null
  const { goals, plan, units } = profile
  const fmt = new Intl.NumberFormat()
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === (plan?.goal ?? 'maintain'))!.label
  const rate = plan && plan.goal !== 'maintain' ? ` · ${formatRate(plan.rateKgPerWeek, units)} / week` : ''

  return (
    <Panel title="Goals" aside={goals.kcal !== undefined ? (goals.macroMode === 'custom' ? 'Your numbers' : 'Calculated') : undefined}>
      {goals.kcal !== undefined ? (
        <div className="space-y-4">
          <p className="font-display text-lg font-bold uppercase tracking-wider">
            {goalLabel}
            <span className="text-muted">{rate}</span>
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBlock label="Calories" value={fmt.format(goals.kcal)} unit="kcal" />
            {goals.proteinG !== undefined && <StatBlock label="Protein" value={goals.proteinG} unit="g" />}
            {goals.carbsG !== undefined && <StatBlock label="Carbs" value={goals.carbsG} unit="g" />}
            {goals.fatG !== undefined && <StatBlock label="Fat" value={goals.fatG} unit="g" />}
          </div>
          <Link to="/me/goals" className={linkClass}>
            Edit goals
            <ChevronRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted">Add your height, weight and goal to get daily calorie and protein targets.</p>
          <Link to="/me/goals" className={linkClass}>
            Set goals
            <ChevronRightIcon size={18} />
          </Link>
        </div>
      )}
    </Panel>
  )
}
