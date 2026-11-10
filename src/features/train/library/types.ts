/**
 * Movement library types. The shared library is bundled with the app
 * (`exercises.json`, from free-exercise-db); custom movements live in Dexie
 * and sync to `users/{uid}/movements`.
 */

/**
 * How a movement is logged:
 * - `weight_reps`     weight × reps (bench press)
 * - `bodyweight_reps` reps only (push-ups)
 * - `assisted`        assistance weight × reps; the weight is subtracted from body weight
 * - `time`            a duration (plank)
 * - `distance_time`   distance + time (running, rowing)
 */
export type TrackingType = 'weight_reps' | 'bodyweight_reps' | 'assisted' | 'time' | 'distance_time'

export const TRACKING_TYPES: readonly TrackingType[] = [
  'weight_reps',
  'bodyweight_reps',
  'assisted',
  'time',
  'distance_time',
]

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight reps',
  assisted: 'Assisted',
  time: 'Time',
  distance_time: 'Distance + time',
}

/** One movement as stored in `exercises.json`. */
export interface LibraryEntry {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  /** `none` when the dataset lists no equipment (mostly stretches). */
  equipment: string
  category: string
  level: string
  instructions: string[]
  /** Number of photos (`{id}/0.jpg`, `{id}/1.jpg`, …) in the dataset repo. */
  images: number
}

/** A movement as the app uses it: library or custom, with its tracking type. */
export interface Movement {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string
  category: string
  /** Library movements only. */
  level?: string
  instructions: string[]
  images: number
  tracking: TrackingType
  source: 'library' | 'custom'
}
