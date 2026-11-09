/**
 * Local-first storage (IndexedDB via Dexie). Tables mirror the Firestore model
 * in CLAUDE.md so sync can be added later without reshaping data.
 * Weights are stored in kg; dates as local `YYYY-MM-DD` keys.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Rank } from './rank'
import type { UnitSystem } from './units'

export interface Profile {
  id: 'me'
  displayName: string
  units: UnitSystem
  totalXp: number
  level: number
  /** Highest rank earned. Never drops. */
  rank: Rank
  streak: number
  /** Highest level already celebrated, so a level-up shows only once. */
  bestLevel: number
  /** Pending level-up / rank-up moment, cleared when the user dismisses it. */
  celebration?: { level: number; rank?: Rank }
  goals: {
    steps?: number
    sleepHours?: number
    waterMl?: number
    kcal?: number
    proteinG?: number
  }
  updatedAt: number
}

/** `check` = simple checkbox; `count` = number target with a + button (e.g. 3 L water). */
export type QuestKind = 'check' | 'count'

/** Fields shared by a quest definition and its daily copy. */
export interface QuestFields {
  title: string
  xp: number
  kind: QuestKind
  /** Count quests only: target amount, unit label and + step. */
  target?: number
  unit?: string
  step?: number
}

/** One of the user's quests (habits). Copied into each day's record. */
export interface QuestDef extends QuestFields {
  id: string
  /** Sort position, ascending. */
  order: number
  updatedAt: number
}

/** A quest as it stood on a given day, with that day's progress. */
export interface Quest extends QuestFields {
  id: string
  /** Count quests only: amount logged so far. */
  value?: number
  done: boolean
}

export interface Day {
  /** `YYYY-MM-DD`, local time. */
  date: string
  quests: Quest[]
  steps?: number
  sleepMinutes?: number
  weightKg?: number
  waterMl?: number
  updatedAt: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  movementIds: string[]
  updatedAt: number
}

export interface LoggedSet {
  movementId: string
  kg: number
  reps: number
  rpe?: number
}

export interface Session {
  id: string
  date: string
  templateId?: string
  sets: LoggedSet[]
  notes?: string
  updatedAt: number
}

export interface FoodEntry {
  id: string
  date: string
  name: string
  barcode?: string
  grams: number
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  updatedAt: number
}

export interface ProgramState {
  id: string
  /** e.g. '66-day-reset', '75-day-challenge', 'custom' */
  kind: string
  startDate: string
  day: number
  strict: boolean
  updatedAt: number
}

export type FromZeroDB = Dexie & {
  profile: EntityTable<Profile, 'id'>
  quests: EntityTable<QuestDef, 'id'>
  days: EntityTable<Day, 'date'>
  workouts: EntityTable<WorkoutTemplate, 'id'>
  sessions: EntityTable<Session, 'id'>
  food: EntityTable<FoodEntry, 'id'>
  programs: EntityTable<ProgramState, 'id'>
}

// IndexedDB name stays 'chalk' (the app's old working name): renaming it would
// orphan every existing device's local data.
export const db = new Dexie('chalk') as FromZeroDB

db.version(1).stores({
  profile: 'id',
  days: 'date',
  workouts: 'id, name',
  sessions: 'id, date, templateId',
  food: 'id, date',
  programs: 'id, kind',
})

db.version(2).stores({
  quests: 'id, order',
})
