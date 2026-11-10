/**
 * First guess at a movement's tracking type, from the dataset's fields.
 * Used only by `scripts/import-exercises.ts` to fill in `trackingTypes.ts`
 * for movements that aren't in it yet; the coach edits that file by hand.
 * Keep this file free of imports other than types (Node runs it directly).
 */
import type { TrackingType } from './types'

export interface RawExercise {
  id: string
  name: string
  category: string
  equipment: string | null
  force?: string | null
}

/** Cardio that has no meaningful distance. */
const TIMED_CARDIO = /rope jumping|stairmaster|step mill/i
/** Holds and other timed work. */
const TIMED = /isometric|plank|wall sit|\bholds?\b|battling ropes|balance board/i
/** Mobility drills the dataset files under stretching but that are done for reps. */
const DYNAMIC_MOBILITY = /hops|inchworm|groiners|lunge|squats|kicks?\b|leg raises|circles|swings?\b/i
/** Pushing or dragging something over a distance. */
const OVER_DISTANCE = /^sled (push|drag)|backward drag|sled drags|sled overhead backward walk|wind sprints/i
/** Bodyweight movements that the dataset files under "other" equipment (bars, rings, straps). */
const BODYWEIGHT_ON_KIT =
  /pull-?ups?|chins?\b|chin-up|dips?\b|push-up|muscle up|inverted row|mid row|suspended|hyperextensions|knee.hip raise|rope climb|otis-up|london bridges|hamstring slides|box jump|jump|hops?\b|bound|skip|leap|push-off|sprint|ab roller/i

export function guessTracking(e: RawExercise): TrackingType {
  const name = e.name
  const equipment = e.equipment ?? 'none'

  if (/assisted/i.test(name)) return 'assisted'
  if (e.category === 'cardio') return TIMED_CARDIO.test(name) ? 'time' : 'distance_time'
  if (OVER_DISTANCE.test(name)) return 'distance_time'
  if (e.category === 'stretching') return DYNAMIC_MOBILITY.test(name) ? 'bodyweight_reps' : 'time'
  if (equipment === 'foam roll') return 'time'
  if (e.force === 'static' || TIMED.test(name)) return 'time'
  if (/weighted/i.test(name)) return 'weight_reps'
  if (equipment === 'body only' || equipment === 'none' || equipment === 'bands' || equipment === 'exercise ball') {
    return 'bodyweight_reps'
  }
  if (equipment === 'other' && BODYWEIGHT_ON_KIT.test(name)) return 'bodyweight_reps'
  return 'weight_reps'
}
