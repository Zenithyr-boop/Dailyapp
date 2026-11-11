/**
 * Program templates and numbers — the coach's to tune.
 *
 * A program's rules become quests while it runs (tagged with the program), so
 * they're ordinary `QuestFields`: checkbox, number target or automatic.
 * Template ids are stored on programs (`ProgramState.kind`): never change them.
 */
import type { QuestFields } from '../../lib/db'
import type { UnitSystem } from '../../lib/units'
import { defaultTitle } from '../quests/links'

/** XP bonus for finishing a program: per program day, capped. 66 days = 1,320 XP, 75 days = 1,500 XP. */
export const PROGRAM_XP_PER_DAY = 20
export const PROGRAM_XP_MAX = 2000

/** Custom program lengths. */
export const PROGRAM_LENGTH_MIN = 7
export const PROGRAM_LENGTH_MAX = 365
/** Rules a program can have. */
export const PROGRAM_RULES_MAX = 12

export function programBonus(length: number): number {
  return Math.min(PROGRAM_XP_MAX, Math.max(0, Math.round(length)) * PROGRAM_XP_PER_DAY)
}

export function clampLength(length: number): number {
  if (!Number.isFinite(length)) return PROGRAM_LENGTH_MIN
  return Math.min(PROGRAM_LENGTH_MAX, Math.max(PROGRAM_LENGTH_MIN, Math.round(length)))
}

export type TemplateId = '66-day-reset' | '75-day-challenge' | 'custom'

export interface ProgramTemplate {
  id: TemplateId
  name: string
  /** One line for the card. */
  blurb: string
  length: number
  /** Strict mode to start with. */
  strict: boolean
  /** The user can switch strict mode before starting. */
  strictChoice: boolean
  /** The user can change the name and length. */
  custom: boolean
  /** The user picks / edits the rules. */
  editableRules: boolean
  /** The rules it starts with (in the user's units, for titles like "Drink 3.8 L water"). */
  rules: (units: UnitSystem) => QuestFields[]
  /** Ideas offered in the builder (66-day reset). */
  suggestions?: (units: UnitSystem) => QuestFields[]
}

const water = (ml: number, xp: number, units: UnitSystem): QuestFields => {
  const link = { source: 'water' as const, target: ml }
  return { title: defaultTitle(link, units), xp, kind: 'check', link }
}

export const TEMPLATES: readonly ProgramTemplate[] = [
  {
    id: '66-day-reset',
    name: '66-day reset',
    blurb: 'Pick the habits you want to lock in and keep them for 66 days. A missed day is marked, not a restart.',
    length: 66,
    strict: false,
    strictChoice: false,
    custom: false,
    editableRules: true,
    rules: () => [],
    suggestions: (units) => [
      { title: 'Walk 8,000 steps', xp: 40, kind: 'check', link: { source: 'steps', target: 8000 } },
      water(2500, 20, units),
      { title: 'Read 10 pages', xp: 30, kind: 'check' },
      { title: 'In bed by 23:00', xp: 40, kind: 'check' },
      { title: 'No added sugar', xp: 30, kind: 'check' },
      { title: 'Meditate 10 minutes', xp: 20, kind: 'check' },
      { title: 'No phone for the first hour', xp: 40, kind: 'check' },
      { title: 'Journal', xp: 20, kind: 'check' },
    ],
  },
  {
    id: '75-day-challenge',
    name: '75-day challenge',
    blurb: 'Two workouts, your diet, 3.8 L of water, 10 pages and a photo, every day for 75 days. Miss one and you start again.',
    length: 75,
    strict: true,
    strictChoice: true,
    custom: false,
    editableRules: false,
    rules: (units) => [
      { title: 'Workout 1 · 45 min', xp: 60, kind: 'check' },
      { title: 'Workout 2 · 45 min, outdoors', xp: 60, kind: 'check' },
      { title: 'Follow your diet · no cheat meals or alcohol', xp: 60, kind: 'check' },
      water(3800, 40, units),
      { title: 'Read 10 pages', xp: 30, kind: 'check' },
      { title: 'Take a progress photo', xp: 20, kind: 'check', link: { source: 'photo' } },
    ],
  },
  {
    id: 'custom',
    name: 'Custom program',
    blurb: 'Your own name, length and rules. Strict mode is up to you.',
    length: 30,
    strict: false,
    strictChoice: true,
    custom: true,
    editableRules: true,
    rules: () => [],
  },
]

export function templateById(id: string | undefined): ProgramTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
