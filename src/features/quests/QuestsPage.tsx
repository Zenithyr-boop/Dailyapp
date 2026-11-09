import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { EditIcon } from '../../components/icons'
import { QuestRow } from '../../components/QuestRow'
import { db } from '../../lib/db'
import { addDays, fromDayKey } from '../../lib/dates'
import { ALL_QUESTS_BONUS } from '../../lib/xp'
import { CountQuestRow } from './CountQuestRow'
import { HistoryPanel } from './HistoryPanel'
import { LevelUpDialog } from './LevelUpDialog'
import { buildHistory } from './progress'
import { dismissCelebration, ensureDay, ensureSetup, setQuestDone, stepCount } from './questsRepo'
import { StatusHeader } from './StatusHeader'
import { useTodayKey } from './useTodayKey'

const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

export function QuestsPage() {
  const today = useTodayKey()

  useEffect(() => {
    ensureSetup().then(() => ensureDay(today))
  }, [today])

  const profile = useLiveQuery(() => db.profile.get('me'), [])
  const day = useLiveQuery(() => db.days.get(today), [today])
  const recent = useLiveQuery(
    () => db.days.where('date').between(addDays(today, -29), today, true, true).toArray(),
    [today],
  )
  const firstDate = useLiveQuery(() => db.days.orderBy('date').first().then((d) => d?.date), [])

  if (!profile || !day || !recent) {
    return <p className="text-muted">Loading quests…</p>
  }

  const quests = day.quests
  const done = quests.filter((q) => q.done).length

  return (
    <div className="space-y-6">
      <StatusHeader profile={profile} doneToday={done} totalToday={quests.length} />

      <section aria-labelledby="quests-h" className="md:border md:border-panel-edge md:bg-panel md:px-6 md:pt-5 md:pb-3">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-2.5">
          <div>
            <p className="text-xs text-muted">{dateLabel.format(fromDayKey(today))}</p>
            <h1 id="quests-h" className="text-[44px] font-extrabold leading-[0.9] md:text-3xl">
              Daily quests
            </h1>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-right">
              <p className="font-display text-3xl font-bold leading-none tabular-nums">
                {done}/{quests.length}
              </p>
              <p className="text-xs whitespace-nowrap text-muted">resets 00:00</p>
            </div>
            <Link
              to="/quests/edit"
              aria-label="Edit quests"
              className="grid size-touch place-items-center border border-panel-edge text-muted hover:border-accent hover:text-accent"
            >
              <EditIcon size={20} />
            </Link>
          </div>
        </div>

        {quests.length === 0 ? (
          <p className="py-6 text-muted">
            No quests yet.{' '}
            <Link to="/quests/edit" className="text-accent underline">
              Add your first quest
            </Link>
          </p>
        ) : (
          <ul>
            {quests.map((q) => (
              <li key={q.id} className="border-b border-line-soft last:border-b-0">
                {q.kind === 'count' ? (
                  <CountQuestRow quest={q} onStep={(dir) => stepCount(today, q.id, dir)} />
                ) : (
                  <QuestRow title={q.title} xp={q.xp} done={q.done} onToggle={(v) => setQuestDone(today, q.id, v)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[13px] text-muted">
        Miss a quest and your streak resets. Finish all {quests.length} for a +{ALL_QUESTS_BONUS} XP bonus.
      </p>

      <HistoryPanel cells={buildHistory(recent, today, 30, firstDate)} />

      {profile.celebration && (
        <LevelUpDialog
          level={profile.celebration.level}
          rank={profile.celebration.rank}
          currentRank={profile.rank}
          onClose={dismissCelebration}
        />
      )}
    </div>
  )
}
