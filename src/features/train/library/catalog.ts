/**
 * The bundled movement library: loading, labels and photo URLs.
 * `exercises.json` is loaded on demand (its own chunk, precached by the
 * service worker), so opening the app doesn't download it and browsing works
 * offline without any Firestore reads.
 */
import { DATASET_RAW } from './dataset'
import { TRACKING } from './trackingTypes'
import type { LibraryEntry, Movement } from './types'

const IMAGE_BASE = `${DATASET_RAW}/exercises`

export function imageUrl(id: string, index: number): string {
  return `${IMAGE_BASE}/${id}/${index}.jpg`
}

export function toMovement(e: LibraryEntry): Movement {
  return { ...e, tracking: TRACKING[e.id] ?? 'weight_reps', source: 'library' }
}

let cache: Promise<Movement[]> | undefined

/** All library movements (loaded once per app session). */
export function loadLibrary(): Promise<Movement[]> {
  cache ??= import('./exercises.json')
    .then((mod) => (mod.default as LibraryEntry[]).map(toMovement))
    .catch((error: unknown) => {
      cache = undefined
      throw error
    })
  return cache
}

// ---- Filter values and labels ------------------------------------------------

export const MUSCLES = [
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'neck',
  'abdominals',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
] as const

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebells',
  'cable',
  'machine',
  'body only',
  'bands',
  'e-z curl bar',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'other',
  'none',
] as const

export const CATEGORIES = [
  'strength',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
  'plyometrics',
  'cardio',
  'stretching',
] as const

const LABELS: Record<string, string> = {
  abdominals: 'Abs',
  quadriceps: 'Quads',
  'middle back': 'Mid back',
  'lower back': 'Lower back',
  kettlebells: 'Kettlebell',
  'body only': 'Bodyweight',
  bands: 'Bands',
  'e-z curl bar': 'EZ bar',
  'medicine ball': 'Med ball',
  'exercise ball': 'Swiss ball',
  'foam roll': 'Foam roller',
  none: 'No equipment',
  'olympic weightlifting': 'Olympic lifting',
}

/** Display label for a muscle, equipment or category value. */
export function label(value: string): string {
  const text = LABELS[value] ?? value
  return text.charAt(0).toUpperCase() + text.slice(1)
}
