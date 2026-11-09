/**
 * Local-first storage (IndexedDB via Dexie). Tables mirror the Firestore model
 * in CLAUDE.md so sync can be added later without reshaping data.
 * Weights are stored in kg; dates as local `YYYY-MM-DD` keys.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Rank } from './xp'
import type { UnitSystem } from './units'

export interface Profile {
  id: 'me'
  displayName: string
  units: UnitSystem
  totalXp: number
  level: number
  rank: Rank
  streak: number
  goals: {
    steps?: number
    sleepHours?: number
    waterMl?: number
    kcal?: number
    proteinG?: number
  }
  updatedAt: number
}

export interface Quest {
  id: string
  title: string
  xp: number
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

export type ChalkDB = Dexie & {
  profile: EntityTable<Profile, 'id'>
  days: EntityTable<Day, 'date'>
  workouts: EntityTable<WorkoutTemplate, 'id'>
  sessions: EntityTable<Session, 'id'>
  food: EntityTable<FoodEntry, 'id'>
  programs: EntityTable<ProgramState, 'id'>
}

export const db = new Dexie('chalk') as ChalkDB

db.version(1).stores({
  profile: 'id',
  days: 'date',
  workouts: 'id, name',
  sessions: 'id, date, templateId',
  food: 'id, date',
  programs: 'id, kind',
})
