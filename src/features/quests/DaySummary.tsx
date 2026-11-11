import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from '../../components/icons'
import type { Day, Profile } from '../../lib/db'
import { canEditQuests } from '../../lib/day'
import { ALL_QUESTS_BONUS, dayXp, isDayComplete } from '../../lib/xp'
import { entriesForDay } from '../food/foodLogRepo'
import { sumTotals } from '../food/nutrition'
import { CalorieBar, MacroBar } from '../food/ui/TotalsBars'
import { useUnits } from '../profile/units'
import { listSessions } from '../train/sessions/sessionsRepo'
import { formatWeight } from '../train/sessions/weights'

const fmt = new Intl.NumberFormat()

interface DaySummaryProps {
  date: string
  today: string
  day: Day | undefined
  /** The user's first day on record (days before it show "before you started"). */
  firstDate: string | undefined
  profile: Profile
}

/** One day at a glance: quests and XP, food against targets, workouts, weight. */
export function DaySummary({ date, today, day, firstDate, profile }: DaySummaryProps) {
  const units = useUnits()
  const food = useLiveQuery(() => entriesForDay(date), [date])
  const sessions = useLiveQuery(async () => (await listSessions()).filter((s) => s.finishedAt && s.date === date), [date])
  const quests = day?.quests ?? []
  const done = quests.filter((q) => q.done).length
  const complete = isDayComplete(quests)
  const xp = day ? dayXp(quests) : 0
  const query = date === today ? '' : `?date=${date}`
  const totals = sumTotals(food ?? [])

  return (
    <div className="space-y-5">
      <section aria-labelledby="sum-quests">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="sum-quests" className="label">
            Quests
          </h3>
          <p className="font-display text-lg font-bold tabular-nums">
            {done}/{quests.length} · {fmt.format(xp)} XP
          </p>
        </div>
        {!day ? (
          <p className="mt-1 text-sm text-muted">{firstDate && date > firstDate ? 'Missed: the app wasn’t opened this day.' : 'Before you started.'}</p>
        ) : (
          <ul className="mt-1">
            {quests.map((q) => (
              <li key={q.id} className="flex items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0">
                <span
                  aria-hidden="true"
                  className={`size-3.5 shrink-0 ${q.done ? 'bg-accent' : 'border-2 border-faint'}`}
                />
                <span className={`flex-1 text-sm ${q.done ? '' : 'text-muted'}`}>
                  {q.title}
                  <span className="sr-only">{q.done ? ': done' : ': missed'}</span>
                </span>
                <span className={`font-display text-sm tabular-nums ${q.done ? 'text-accent' : 'text-faint'}`}>+{q.xp}</span>
              </li>
            ))}
            {complete && (
              <li className="flex justify-between py-1.5 text-sm">
                All quests bonus <span className="font-display tabular-nums text-accent">+{ALL_QUESTS_BONUS}</span>
              </li>
            )}
          </ul>
        )}
        <SummaryLink to={`/quests${query}`}>{canEditQuests(date, today) ? 'Open quests' : 'View quests'}</SummaryLink>
      </section>

      <section aria-labelledby="sum-food">
        <h3 id="sum-food" className="label mb-2">
          Food
        </h3>
        {food && food.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged.</p>
        ) : (
          <div className="space-y-3">
            <CalorieBar kcal={totals.kcal} target={profile.goals.kcal} />
            <div className="grid grid-cols-3 gap-3">
              <MacroBar label="Protein" grams={totals.proteinG} target={profile.goals.proteinG} />
              <MacroBar label="Carbs" grams={totals.carbsG} target={profile.goals.carbsG} />
              <MacroBar label="Fat" grams={totals.fatG} target={profile.goals.fatG} />
            </div>
          </div>
        )}
        <SummaryLink to={`/food${query}`}>Open food</SummaryLink>
      </section>

      <section aria-labelledby="sum-train">
        <h3 id="sum-train" className="label mb-1">
          Workout
        </h3>
        {sessions && sessions.length === 0 && <p className="text-sm text-muted">No workout logged.</p>}
        {sessions?.map((s) => (
          <SummaryLink key={s.id} to={`/train/sessions/${encodeURIComponent(s.id)}`}>
            {s.name}
          </SummaryLink>
        ))}
        {sessions && sessions.length === 0 && <SummaryLink to={`/train${query}`}>Open train</SummaryLink>}
      </section>

      {day?.weightKg !== undefined && (
        <section aria-labelledby="sum-weight" className="flex items-baseline justify-between">
          <h3 id="sum-weight" className="label">
            Weight
          </h3>
          <p className="font-display text-lg font-bold tabular-nums">{formatWeight(day.weightKg, units)}</p>
        </section>
      )}
    </div>
  )
}

function SummaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex min-h-touch items-center justify-between font-display text-sm font-bold uppercase tracking-wider hover:text-accent"
    >
      {children}
      <ChevronRightIcon size={18} className="text-faint group-hover:text-accent" />
    </Link>
  )
}
