import { fromDayKey } from '../../lib/day'
import type { QuestFields } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { linkSummary } from '../quests/links'

const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** "3 Nov". */
export const formatShort = (key: string) => shortDate.format(fromDayKey(key))
/** "3 Nov 2026". */
export const formatFull = (key: string) => fullDate.format(fromDayKey(key))

/** What a rule asks for, in one line ("Auto · Water ≥ 3.8 L", "Checkbox"). */
export function ruleSummary(rule: QuestFields, units: UnitSystem): string {
  if (rule.link) return `Auto · ${linkSummary(rule.link, units)}`
  if (rule.kind === 'count') return `Target ${num.format(rule.target ?? 1)}${rule.unit ? ` ${rule.unit}` : ''}`
  return 'Checkbox'
}
