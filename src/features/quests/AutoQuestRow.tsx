import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ProgramTag, QuestXp } from '../../components/QuestRow'
import { PlusIcon } from '../../components/icons'
import type { Quest } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import type { StatKind } from '../today/statsRepo'
import { describeLink, ML_PER_OZ, type LinkData } from './links'

const actionClass =
  'inline-flex min-h-touch min-w-16 shrink-0 items-center justify-center border border-panel-edge px-2 font-display text-sm font-bold uppercase tracking-wider text-muted hover:border-accent hover:text-accent'

/**
 * An automatic quest: ticks itself from real data, so there's no checkbox to
 * press. Shows an AUTO tag, live progress and a shortcut to log the data.
 */
export function AutoQuestRow({
  quest,
  data,
  date,
  today,
  units,
  locked,
  onStat,
  onAddWater,
  programName,
}: {
  quest: Quest
  /** The program this quest is a rule of (shown as a tag). */
  programName?: string
  data: LinkData | undefined
  date: string
  today: string
  units: UnitSystem
  /** A past day outside the grace window: no shortcuts. */
  locked: boolean
  onStat: (stat: StatKind) => void
  onAddWater: (ml: number) => void
}) {
  const link = quest.link!
  const dateQuery = date === today ? '' : `?date=${date}`
  const waterStep = units === 'metric' ? 250 : Math.round(8 * ML_PER_OZ)

  let action: ReactNode = null
  if (!locked) {
    switch (link.source) {
      case 'steps':
      case 'sleep':
        action = (
          <button type="button" className={actionClass} onClick={() => onStat(link.source as StatKind)} aria-label={`Log ${link.source} for ${quest.title}`}>
            Log
          </button>
        )
        break
      case 'water':
        action = (
          <span className="flex gap-1">
            <button
              type="button"
              className={`${actionClass} w-11 px-0`}
              onClick={() => onAddWater(waterStep)}
              aria-label={`Add ${units === 'metric' ? '250 ml' : '8 oz'} water`}
              title={units === 'metric' ? '+250 ml' : '+8 oz'}
            >
              <PlusIcon size={18} />
            </button>
            <button type="button" className={actionClass} onClick={() => onStat('water')} aria-label="Set the day’s water">
              Log
            </button>
          </span>
        )
        break
      case 'protein':
      case 'calories':
        action = (
          <Link to={`/food${dateQuery}`} className={actionClass} aria-label={`Open Food for ${quest.title}`}>
            Food
          </Link>
        )
        break
      case 'weighIn':
        action = (
          <Link to={date === today ? '/body' : `/body?weigh=${date}`} className={actionClass} aria-label={`Weigh in for ${quest.title}`}>
            Weigh
          </Link>
        )
        break
      case 'workout':
        action = (
          <Link to="/train" className={actionClass} aria-label={`Open Train for ${quest.title}`}>
            Train
          </Link>
        )
        break
      case 'photo':
        action = (
          <Link to="/body/photos" className={actionClass} aria-label={`Add a progress photo for ${quest.title}`}>
            Photo
          </Link>
        )
        break
    }
  }

  return (
    <div className="flex min-h-[58px] items-center gap-3.5 py-2">
      <span
        role="img"
        aria-label={quest.done ? 'Done' : 'Not done yet'}
        className={`grid size-[26px] shrink-0 place-content-center ${quest.done ? 'bg-accent' : 'border-2 border-dashed border-faint'}`}
      >
        {quest.done && (
          <svg viewBox="0 0 24 24" className="size-[22px] stroke-on-accent" fill="none" strokeWidth={3} strokeLinecap="square" aria-hidden="true">
            <path d="M6.5 12.5l3.5 3.5 7.5-8" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className={`font-medium ${quest.done ? 'text-muted' : ''}`}>{quest.title}</span>
          <span className="border border-panel-edge px-1 font-display text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-muted" title="Ticks itself from your data">
            Auto
          </span>
          {programName && <ProgramTag name={programName} />}
        </span>
        {data && <span className="block text-xs text-muted">{describeLink(link, data, units)}</span>}
      </div>
      {action}
      <QuestXp xp={quest.xp} done={quest.done} />
    </div>
  )
}
