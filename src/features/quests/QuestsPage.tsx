import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { DateSwitcher } from '../../components/DateSwitcher'
import { EditIcon } from '../../components/icons'
import { QuestRow } from '../../components/QuestRow'
import { db } from '../../lib/db'
import { addDays, canEditQuests, clampDay, formatCountdown, longDayLabel, useDayClock } from '../../lib/day'
import { ALL_QUESTS_BONUS, progressFromDays } from '../../lib/xp'
import { CountQuestRow } from './CountQuestRow'
import { HistoryPanel } from './HistoryPanel'
import { LevelUpDialog } from './LevelUpDialog'
import { buildHistory } from './progress'
import { useQuestDays } from './questDays'
import { dismissCelebration, ensureDay, ensureSetup, getCelebration, setQuestDone, stepCount } from './questsRepo'
import { StatusHeader } from './StatusHeader'
import { ResumeBanner } from '../train/sessions/ResumeBanner'
import { useOverlay } from '../../components/useOverlay'
import { FoodTodayPanel, VolumePanel, WeightPanel } from '../today/DashboardPanels'
import { StatDialog } from '../today/StatDialog'
import { addWater, isStatKind } from '../today/statsRepo'
import { TodayStrip } from '../today/TodayStrip'
import { AutoQuestRow } from './AutoQuestRow'
import { linkDataFor } from './autoQuests'

/** A tick that lands after the day closed (the clock moved on) is simply dropped. */
const ignoreLocked = (p: Promise<void>) => p.catch(() => {})

export function QuestsPage() {
  const { today, msLeft } = useDayClock()
  const overlay = useOverlay()
  const params = overlay.params
  const date = clampDay(params.get('date'), today)
  const isToday = date === today
  const editable = canEditQuests(date, today)

  // Today's record (from the profile's day-start hour, so it never runs ahead of a just-changed setting).
  useEffect(() => {
    ensureSetup().then(() => ensureDay())
  }, [today])

  const profile = useLiveQuery(() => db.profile.get('me'), [])
  const qd = useQuestDays(today)
  const celebration = useLiveQuery(getCelebration, [])
  const todayRecord = qd?.byDate.get(today)
  const goals = profile?.goals
  // Live numbers for the strip and automatic quests (re-read whenever food, stats, workouts or goals change).
  const linkData = useLiveQuery(() => linkDataFor(date, goals), [date, goals])
  const statParam = params.get('stat')
  const units = profile?.units ?? 'metric'

  if (!profile || !qd || !todayRecord) {
    return <p className="text-muted">Loading quests…</p>
  }

  // XP, level and streak are worked out from the full history.
  const progress = progressFromDays(qd.days, today)
  const recent = qd.days.filter((d) => d.date >= addDays(today, -29) && d.date <= today)
  const shown = qd.byDate.get(date)
  const quests = shown?.quests ?? []
  const done = quests.filter((q) => q.done).length
  const countdown = formatCountdown(msLeft)
  const status = isToday ? `resets in ${countdown}` : editable ? `open for ${countdown}` : 'closed'

  return (
    <div className="space-y-6">
      <ResumeBanner />
      <StatusHeader
        rank={profile.rank}
        progress={progress}
        doneToday={todayRecord.quests.filter((q) => q.done).length}
        totalToday={todayRecord.quests.length}
      />

      <TodayStrip date={date} today={today} data={linkData} goals={profile.goals} onStat={(s) => overlay.open('stat', s)} />

      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-6">
      <section aria-labelledby="quests-h" className="md:border md:border-panel-edge md:bg-panel md:px-6 md:pt-5 md:pb-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{longDayLabel(date)}</p>
          <DateSwitcher date={date} today={today} dayInfo={qd.info} />
        </div>
        <div className="flex items-end justify-between gap-4 border-b border-line pb-2.5">
          <h1 id="quests-h" className="text-[44px] font-extrabold leading-[0.9] md:text-3xl">
            Daily quests
          </h1>
          <div className="flex items-end gap-3">
            <div className="text-right">
              <p className="font-display text-3xl font-bold leading-none tabular-nums">
                {done}/{quests.length}
              </p>
              <p className="text-xs whitespace-nowrap text-muted" aria-live="off">
                {status}
              </p>
            </div>
            {isToday && (
              <Link
                to="/quests/edit"
                aria-label="Edit quests"
                className="grid size-touch place-items-center border border-panel-edge text-muted hover:border-accent hover:text-accent"
              >
                <EditIcon size={20} />
              </Link>
            )}
          </div>
        </div>

        {!shown ? (
          <p className="py-6 text-muted">
            {qd.firstDate && date > qd.firstDate ? 'Missed: the app wasn’t opened this day.' : 'Before you started.'}
          </p>
        ) : quests.length === 0 ? (
          <p className="py-6 text-muted">
            No quests {isToday ? 'yet' : 'this day'}.{' '}
            {isToday && (
              <Link to="/quests/edit" className="text-accent underline">
                Add your first quest
              </Link>
            )}
          </p>
        ) : (
          <ul>
            {quests.map((q) => (
              <li key={q.id} className="border-b border-line-soft last:border-b-0">
                {q.link ? (
                  <AutoQuestRow
                    quest={q}
                    data={linkData}
                    date={date}
                    today={today}
                    units={units}
                    locked={!editable}
                    onStat={(s) => overlay.open('stat', s)}
                    onAddWater={(ml) => void addWater(date, ml)}
                  />
                ) : q.kind === 'count' ? (
                  <CountQuestRow quest={q} locked={!editable} onStep={(dir) => ignoreLocked(stepCount(date, q.id, dir))} />
                ) : (
                  <QuestRow
                    title={q.title}
                    xp={q.xp}
                    done={q.done}
                    locked={!editable}
                    onToggle={(v) => ignoreLocked(setQuestDone(date, q.id, v))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[13px] text-muted">
        {isToday
          ? `Miss a quest and your streak resets. Finish all ${quests.length} for a +${ALL_QUESTS_BONUS} XP bonus.`
          : editable
            ? `Yesterday stays open until today resets, in case you forgot to tick something. Finish all for +${ALL_QUESTS_BONUS} XP.`
            : 'This day is closed. Quests can be changed today and yesterday only.'}
      </p>

      <HistoryPanel cells={buildHistory(recent, today, 30, qd.firstDate)} />
      </div>

      {/* Desktop dashboard: the week at a glance beside the quests. */}
      <aside aria-label="At a glance" className="hidden space-y-4 lg:block">
        <VolumePanel today={today} units={units} />
        <FoodTodayPanel today={today} goals={profile.goals} />
        <WeightPanel today={today} units={units} />
      </aside>
      </div>

      {isStatKind(statParam) && (
        <StatDialog
          stat={statParam}
          date={date}
          today={today}
          values={{ steps: linkData?.steps, sleepMinutes: linkData?.sleepMinutes, waterMl: linkData?.waterMl }}
          units={units}
          onClose={() => overlay.close('stat')}
        />
      )}

      {celebration && (
        <LevelUpDialog
          level={celebration.level}
          rank={celebration.rank}
          currentRank={profile.rank}
          onClose={dismissCelebration}
        />
      )}
    </div>
  )
}
