/**
 * Starter workout templates, bundled with the app. EDIT FREELY: names, notes,
 * sets, reps, RPE and rest. A test checks every movement id exists in the
 * library and that each target fits the movement's tracking type.
 *
 * How they're stored: a starter lives only in this file until the user edits
 * or deletes it. Then it is saved under its fixed id (`starter-…`), so:
 * - a new device holds no workout records and still counts as untouched on
 *   first sign-in (`isPristine`);
 * - the same starter edited on two devices is one record (newer edit wins),
 *   never two copies.
 * NEVER change a starter's id: edited copies on users' devices point at it.
 *
 * Programming: beginner to intermediate. Main lifts 3 × 5–8 at RPE 8 with long
 * rests, accessories 8–12, isolation work 12–15 in supersets to save time.
 */
import type { WorkoutItem, WorkoutTemplate } from '../../../lib/db'

export const STARTER_PREFIX = 'starter-'

export interface StarterProgram {
  id: string
  name: string
  description: string
  workouts: WorkoutTemplate[]
}

type Opts = { rpe?: number; note?: string; group?: string }

/** Rep-based item: sets × min–max reps, rest in seconds. */
function reps(movementId: string, sets: number, min: number, max: number, restSec: number, opts: Opts = {}) {
  return { movementId, sets, repsMin: min, repsMax: max, restSec, rpe: 8, ...opts }
}

/** Timed item: sets × seconds. */
function timed(movementId: string, sets: number, seconds: number, restSec: number, opts: Opts = {}) {
  return { movementId, sets, seconds, restSec, ...opts }
}

function workout(id: string, name: string, note: string, items: Omit<WorkoutItem, 'key'>[]): WorkoutTemplate {
  return {
    id: STARTER_PREFIX + id,
    name,
    note,
    items: items.map((item, i) => ({ ...item, key: `${id}-${i + 1}` })),
    updatedAt: 0,
  }
}

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const PER_LEG = 'Reps per leg.'
const PULLUP_SWAP = 'Swap for pull-ups once you can do 8 clean reps.'

export const STARTER_PROGRAMS: readonly StarterProgram[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: '3 days a week, or 6 if you run it twice.',
    workouts: [
      workout('ppl-push', 'Push', 'Chest, shoulders, triceps.', [
        reps(BENCH, 3, 6, 8, 150),
        reps('Standing_Military_Press', 3, 6, 10, 120),
        reps('Incline_Dumbbell_Press', 3, 8, 12, 90),
        reps('Side_Lateral_Raise', 3, 12, 15, 60, { rpe: 9, group: 'a' }),
        reps('Triceps_Pushdown_-_Rope_Attachment', 3, 10, 12, 60, { rpe: 9, group: 'a' }),
      ]),
      workout('ppl-pull', 'Pull', 'Back, rear delts, biceps.', [
        reps('Wide-Grip_Lat_Pulldown', 3, 8, 10, 120, { note: PULLUP_SWAP }),
        reps('Bent_Over_Barbell_Row', 3, 6, 8, 150),
        reps('Seated_Cable_Rows', 3, 10, 12, 90),
        reps('Face_Pull', 3, 12, 15, 60, { group: 'a' }),
        reps('Dumbbell_Bicep_Curl', 3, 8, 12, 60, { rpe: 9, group: 'a' }),
      ]),
      workout('ppl-legs', 'Legs', 'Quads, hamstrings, calves, core.', [
        reps('Barbell_Squat', 3, 5, 8, 180),
        reps('Romanian_Deadlift', 3, 8, 10, 150),
        reps('Leg_Press', 3, 10, 12, 120),
        reps('Lying_Leg_Curls', 3, 10, 12, 60, { rpe: 9, group: 'a' }),
        reps('Standing_Calf_Raises', 3, 10, 15, 60, { rpe: 9, group: 'a' }),
        timed('Plank', 3, 30, 60),
      ]),
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: '4 days a week: upper, lower, rest, upper, lower.',
    workouts: [
      workout('ul-upper', 'Upper', 'Press, row, shoulders, arms.', [
        reps(BENCH, 3, 6, 8, 150),
        reps('Bent_Over_Barbell_Row', 3, 6, 8, 150),
        reps('Dumbbell_Shoulder_Press', 3, 8, 10, 120),
        reps('Wide-Grip_Lat_Pulldown', 3, 8, 12, 90),
        reps('Hammer_Curls', 2, 10, 12, 60, { rpe: 9, group: 'a' }),
        reps('EZ-Bar_Skullcrusher', 2, 10, 12, 60, { rpe: 9, group: 'a' }),
      ]),
      workout('ul-lower', 'Lower', 'Squat, hinge, single leg, core.', [
        reps('Barbell_Squat', 3, 5, 8, 180),
        reps('Romanian_Deadlift', 3, 8, 10, 150),
        reps('Dumbbell_Lunges', 2, 10, 12, 90, { note: PER_LEG }),
        reps('Leg_Extensions', 2, 12, 15, 60, { rpe: 9, group: 'a' }),
        reps('Lying_Leg_Curls', 2, 10, 12, 60, { rpe: 9, group: 'a' }),
        reps('Standing_Calf_Raises', 3, 12, 15, 60, { rpe: 9 }),
        reps('Hanging_Leg_Raise', 3, 8, 12, 60),
      ]),
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body, 3 days',
    description: 'Mon / Wed / Fri: A, B, C. Best place to start.',
    workouts: [
      workout('fb-a', 'Full Body A', 'Squat and bench day.', [
        reps('Barbell_Squat', 3, 5, 8, 180),
        reps(BENCH, 3, 6, 8, 150),
        reps('Bent_Over_Barbell_Row', 3, 8, 10, 120),
        timed('Plank', 3, 30, 60),
      ]),
      workout('fb-b', 'Full Body B', 'Deadlift and overhead press day.', [
        reps('Barbell_Deadlift', 3, 5, 5, 180, { rpe: 7, note: 'Leave 3 reps in the tank. Form first.' }),
        reps('Standing_Military_Press', 3, 6, 8, 150),
        reps('Wide-Grip_Lat_Pulldown', 3, 8, 12, 90, { note: PULLUP_SWAP }),
        reps('Dumbbell_Lunges', 2, 10, 12, 90, { note: PER_LEG }),
        reps('Cable_Crunch', 3, 12, 15, 60),
      ]),
      workout('fb-c', 'Full Body C', 'Lighter day: higher reps, dumbbells and machines.', [
        reps('Goblet_Squat', 3, 10, 12, 90),
        reps('Incline_Dumbbell_Press', 3, 8, 12, 90),
        reps('Seated_Cable_Rows', 3, 10, 12, 90),
        reps('Barbell_Hip_Thrust', 3, 8, 12, 120),
        reps('Side_Lateral_Raise', 2, 12, 15, 60, { rpe: 9, group: 'a' }),
        reps('Dumbbell_Bicep_Curl', 2, 10, 12, 60, { rpe: 9, group: 'a' }),
      ]),
    ],
  },
]

export const STARTERS: readonly WorkoutTemplate[] = STARTER_PROGRAMS.flatMap((p) => p.workouts)

const byId = new Map(STARTERS.map((w) => [w.id, w]))

export function isStarterId(id: string): boolean {
  return id.startsWith(STARTER_PREFIX)
}

/** A fresh copy of a bundled starter, or undefined. */
export function starterById(id: string): WorkoutTemplate | undefined {
  const w = byId.get(id)
  return w && structuredClone(w)
}
