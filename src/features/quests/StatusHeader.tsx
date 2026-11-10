import { RankBadge } from '../../components/RankBadge'
import { XpBar } from '../../components/XpBar'
import { nextRank, type Rank } from '../../lib/rank'
import type { DerivedProgress } from '../../lib/xp'

interface StatusHeaderProps {
  /** Earned rank (stored, never drops). */
  rank: Rank
  /** XP, level and streak derived from the day history. */
  progress: DerivedProgress
  doneToday: number
  totalToday: number
}

/** Rank badge, level, 10-block XP bar and XP numbers; streak/today stats beside it. */
export function StatusHeader({ rank, progress, doneToday, totalToday }: StatusHeaderProps) {
  const next = nextRank(rank, { level: progress.level })
  const nextHint = next?.trials.find((t) => !t.passed)

  return (
    <header className="flex flex-wrap items-center gap-x-10 gap-y-4">
      <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-3.5">
        <RankBadge rank={rank} size="lg" />
        <div className="min-w-0 flex-1">
          <XpBar current={progress.xpIntoLevel} max={progress.xpForLevel} label={`Level ${progress.level}`} size="lg" />
          {next && nextHint && (
            <p className="mt-1.5 text-xs text-muted">
              Rank <span className="text-rank">{next.rank}</span>: {nextHint.trial.label}
            </p>
          )}
        </div>
      </div>
      <dl className="flex gap-8">
        <div>
          <dt className="text-xs text-muted">Streak</dt>
          <dd className="font-display text-3xl font-bold leading-none tabular-nums md:text-5xl">
            {progress.streak}
            <span className="text-base text-muted md:text-xl"> {progress.streak === 1 ? 'day' : 'days'}</span>
          </dd>
        </div>
        <div className="hidden md:block">
          <dt className="text-xs text-muted">Today</dt>
          <dd className="font-display text-5xl font-bold leading-none tabular-nums">
            {doneToday}
            <span className="text-xl text-muted"> / {totalToday}</span>
          </dd>
        </div>
      </dl>
    </header>
  )
}
