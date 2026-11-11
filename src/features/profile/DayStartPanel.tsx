import { useId } from 'react'
import { Panel } from '../../components/Panel'
import { DAY_START_HOURS, dayStartLabel, formatCountdown, useDayClock } from '../../lib/day'
import { inputClass } from '../train/workouts/fields'
import { setDayStartHour } from './units'

/** Me → "Day starts at": midnight by default, up to 4 AM for late nights. */
export function DayStartPanel() {
  const id = useId()
  const { startHour, msLeft } = useDayClock()

  return (
    <Panel title="Day">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor={id} className="label">
            Day starts at
          </label>
          <p id={`${id}-help`} className="mt-1 text-sm text-muted">
            Quests reset at this time. Anything before it, like a late meal or going to bed at 00:30, counts toward the
            day before. Next reset in {formatCountdown(msLeft)}.
          </p>
        </div>
        <select
          id={id}
          aria-describedby={`${id}-help`}
          value={startHour}
          onChange={(e) => void setDayStartHour(Number(e.target.value))}
          className={`${inputClass} w-auto min-w-36`}
        >
          {DAY_START_HOURS.map((h) => (
            <option key={h} value={h}>
              {dayStartLabel(h)}
            </option>
          ))}
        </select>
      </div>
    </Panel>
  )
}
