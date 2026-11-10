import { Link } from 'react-router'
import type { Profile } from '../../../lib/db'
import { formatG, formatKcal, type Totals } from '../nutrition'

const SEGMENTS = 10

type Goals = Profile['goals'] | undefined

/** "1,450 / 2,300" with what's left or over, for screen readers and the label. */
function leftText(value: number, target: number, unit: string): string {
  const diff = Math.round((target - value) * 10) / 10
  if (diff >= 0) return `${unit === 'kcal' ? formatKcal(diff) : formatG(diff)} ${unit} left`
  return `${unit === 'kcal' ? formatKcal(-diff) : formatG(-diff)} ${unit} over`
}

/** 10-block segmented calorie bar against the day's target. */
export function CalorieBar({ kcal, target }: { kcal: number; target?: number }) {
  const fraction = target ? Math.min(1, kcal / target) : 0
  const filled = Math.floor(fraction * SEGMENTS + 1e-9)
  const label = target ? `Calories: ${formatKcal(kcal)} of ${formatKcal(target)} kcal, ${leftText(kcal, target, 'kcal')}` : `Calories: ${formatKcal(kcal)} kcal`
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Calories</span>
        <span className="text-sm tabular-nums text-muted">
          <span className="font-display text-xl font-bold text-text">{formatKcal(kcal)}</span>
          {target ? ` / ${formatKcal(target)} kcal` : ' kcal'}
        </span>
      </div>
      {target ? (
        <>
          <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(kcal)} className="grid grid-cols-10 gap-1">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <div key={i} className={`h-3 ${i < filled ? 'bg-accent' : 'bg-line'}`} />
            ))}
          </div>
          <p className={`mt-1.5 text-right text-sm tabular-nums ${kcal > target ? 'text-text' : 'text-muted'}`}>{leftText(kcal, target, 'kcal')}</p>
        </>
      ) : null}
    </div>
  )
}

/** Flat bar for one macro: "Protein 120 / 160 g". */
export function MacroBar({ label, grams, target }: { label: string; grams: number; target?: number }) {
  const pct = target ? Math.min(100, (grams / target) * 100) : 0
  return (
    <div>
      <div className="mb-1">
        <span className="label block">{label}</span>
        <span className="block whitespace-nowrap text-sm tabular-nums text-muted">
          <span className="font-semibold text-text">{formatG(grams)}</span>
          {target ? ` / ${formatG(target)} g` : ' g'}
        </span>
      </div>
      {target ? (
        <div
          role="progressbar"
          aria-label={`${label}: ${formatG(grams)} of ${formatG(target)} g, ${leftText(grams, target, 'g')}`}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.round(grams)}
          className="h-2 bg-line"
        >
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="h-2 bg-line" aria-hidden="true" />
      )}
    </div>
  )
}

/** The day's totals against the targets from onboarding / Me → Goals. */
export function DayTotals({ totals, goals }: { totals: Totals; goals: Goals }) {
  const hasTargets = !!goals?.kcal
  return (
    <section aria-label="Today's totals" className="border border-panel-edge bg-panel p-4">
      <CalorieBar kcal={totals.kcal} target={goals?.kcal} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MacroBar label="Protein" grams={totals.proteinG} target={goals?.proteinG} />
        <MacroBar label="Carbs" grams={totals.carbsG} target={goals?.carbsG} />
        <MacroBar label="Fat" grams={totals.fatG} target={goals?.fatG} />
      </div>
      {!hasTargets && (
        <p className="mt-3 text-sm text-muted">
          No targets yet.{' '}
          <Link to="/me/goals" className="text-accent underline underline-offset-2 hover:text-text">
            Set your goals
          </Link>{' '}
          to see what’s left.
        </p>
      )}
    </section>
  )
}

/** One line of macros: "P 30 · C 50 · F 12 g". */
export function MacroLine({ totals, className = '' }: { totals: Totals; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      <abbr title="Protein" className="no-underline">P</abbr> {formatG(totals.proteinG)} · <abbr title="Carbs" className="no-underline">C</abbr>{' '}
      {formatG(totals.carbsG)} · <abbr title="Fat" className="no-underline">F</abbr> {formatG(totals.fatG)} g
    </span>
  )
}
