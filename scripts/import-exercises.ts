/**
 * Imports the movement library from free-exercise-db (Unlicense) into the app.
 *
 *   npm run import:exercises
 *
 * - Writes `src/features/train/library/exercises.json` (only the fields the app uses).
 * - Adds a guessed tracking type to `trackingTypes.ts` for every movement that
 *   isn't listed there yet. Existing lines (the coach's edits) are kept as they are.
 *
 * The dataset is pinned to one commit so re-running gives the same result.
 * Movement ids are the dataset's ids and must never change: logged sets point at them.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { guessTracking, type RawExercise } from '../src/features/train/library/guessTracking.ts'
import { TRACKING_TYPES, type LibraryEntry, type TrackingType } from '../src/features/train/library/types.ts'

export const DATASET_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const SOURCE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${DATASET_COMMIT}/dist/exercises.json`

const libraryDir = fileURLToPath(new URL('../src/features/train/library/', import.meta.url))
const jsonPath = `${libraryDir}exercises.json`
const trackingPath = `${libraryDir}trackingTypes.ts`

interface SourceExercise extends RawExercise {
  level: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
}

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
const source = (await res.json()) as SourceExercise[]

for (const e of source) {
  if (!/^[A-Za-z0-9_-]+$/.test(e.id)) throw new Error(`Unexpected id: ${e.id}`)
  const expected = e.images.map((_, i) => `${e.id}/${i}.jpg`)
  if (JSON.stringify(expected) !== JSON.stringify(e.images)) throw new Error(`Unexpected image paths for ${e.id}`)
}

const entries: LibraryEntry[] = source
  .map((e) => ({
    id: e.id,
    name: e.name.trim(),
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment ?? 'none',
    category: e.category,
    level: e.level,
    instructions: e.instructions.map((s) => s.trim()).filter(Boolean),
    images: e.images.length,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

await writeFile(jsonPath, JSON.stringify(entries) + '\n')

// ---- trackingTypes.ts: keep existing lines, add guesses for new movements ----

const existing = new Map<string, TrackingType>()
try {
  const text = await readFile(trackingPath, 'utf8')
  for (const m of text.matchAll(/^\s*"([^"]+)":\s*"(\w+)",?/gm)) {
    if (!TRACKING_TYPES.includes(m[2] as TrackingType)) throw new Error(`Unknown tracking type "${m[2]}" for ${m[1]}`)
    existing.set(m[1]!, m[2] as TrackingType)
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

let added = 0
const lines = entries.map((e) => {
  let type = existing.get(e.id)
  if (!type) {
    type = guessTracking(source.find((s) => s.id === e.id)!)
    added++
  }
  return `  ${JSON.stringify(e.id)}: ${JSON.stringify(type)},`
})
const removed = [...existing.keys()].filter((id) => !entries.some((e) => e.id === id))

const header = `/**
 * How each library movement is logged. EDIT FREELY: change the value on any line.
 *
 *   "weight_reps"      weight × reps (bench press)
 *   "bodyweight_reps"  reps only (push-ups)
 *   "assisted"         assistance weight × reps, subtracted from body weight
 *   "time"             a duration (plank, stretches)
 *   "distance_time"    distance + time (running, rowing)
 *
 * \`npm run import:exercises\` keeps every line here and only adds guesses for
 * movements that are new in the dataset. Movements missing from this list are
 * logged as weight × reps.
 */
import type { TrackingType } from './types'

export const TRACKING: Record<string, TrackingType> = {
`
await writeFile(trackingPath, header + lines.join('\n') + '\n}\n')

console.log(`Wrote ${entries.length} movements to exercises.json`)
console.log(`trackingTypes.ts: kept ${existing.size - removed.length}, guessed ${added} new`)
if (removed.length) console.log(`No longer in the dataset (dropped): ${removed.join(', ')}`)
