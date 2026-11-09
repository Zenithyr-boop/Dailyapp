import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { QuestRow } from '../../components/QuestRow'
import { RankBadge } from '../../components/RankBadge'
import { StatBlock } from '../../components/StatBlock'
import { XpBar } from '../../components/XpBar'
import { PageHeader } from '../../components/PageHeader'
import { ALL_QUESTS_BONUS, dayXp, levelFromTotalXp, rankForLevel } from '../../lib/xp'

// Sample quests so the screen shows the design. Not saved anywhere yet —
// real quests come from the user's habits in the quests feature.
const SAMPLE_QUESTS = [
  { id: 'water', title: 'Drink 3 L of water', xp: 20 },
  { id: 'steps', title: 'Walk 8,000 steps', xp: 30 },
  { id: 'train', title: 'Complete a workout', xp: 50 },
  { id: 'read', title: 'Read 10 pages', xp: 20 },
]

const todayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function TodayPage() {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const quests = SAMPLE_QUESTS.map((q) => ({ ...q, done: !!done[q.id] }))
  const earned = dayXp(quests)
  const progress = levelFromTotalXp(earned)
  const rank = rankForLevel(progress.level)
  const completed = quests.filter((q) => q.done).length

  return (
    <>
      <PageHeader title="Daily quests" kicker={todayLabel.format(new Date())} />

      <div className="space-y-4">
        <Panel title="Status">
          <div className="flex items-center gap-4">
            <RankBadge rank={rank} size="lg" />
            <div className="flex-1">
              <XpBar current={progress.xpIntoLevel} max={progress.xpForLevel} label={`Level ${progress.level}`} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line-soft pt-4">
            <StatBlock label="Streak" value={0} unit="days" />
            <StatBlock label="Today" value={earned} unit="XP" />
            <StatBlock label="Done" value={`${completed}/${quests.length}`} />
          </div>
        </Panel>

        <Panel title="Quests" aside={`Clear all: +${ALL_QUESTS_BONUS} XP`}>
          <div className="-my-2">
            {quests.map((q) => (
              <QuestRow
                key={q.id}
                title={q.title}
                xp={q.xp}
                done={q.done}
                onToggle={(value) => setDone((d) => ({ ...d, [q.id]: value }))}
              />
            ))}
          </div>
        </Panel>

        <p className="text-sm text-muted">
          These are sample quests and aren't saved. Setting up your own habits comes next.
        </p>
      </div>
    </>
  )
}
