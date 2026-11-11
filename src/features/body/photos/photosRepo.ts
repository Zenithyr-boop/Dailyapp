/**
 * Progress photos. Device-only: stored in IndexedDB (`photos` + `photoImages`),
 * never uploaded, never synced (neither table is in SYNCED_TABLES).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PhotoPose, type ProgressPhoto } from '../../../lib/db'
import { getToday } from '../../../lib/day'
import { FutureDayError } from '../bodyRepo'
import type { PreparedImage } from './image'

export const POSES: readonly { id: PhotoPose; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
]

export const poseLabel = (pose: PhotoPose | undefined) => POSES.find((p) => p.id === pose)?.label

export function isPose(v: unknown): v is PhotoPose {
  return POSES.some((p) => p.id === v)
}

export async function addPhoto(prepared: PreparedImage, date: string, pose?: PhotoPose): Promise<string> {
  if (date > (await getToday())) throw new FutureDayError(date)
  const id = crypto.randomUUID()
  const { image, ...rest } = prepared
  const photo: ProgressPhoto = { id, date, ...rest, addedAt: Date.now() }
  if (pose) photo.pose = pose
  await db.transaction('rw', db.photos, db.photoImages, async () => {
    await db.photos.add(photo)
    await db.photoImages.add({ id, image })
  })
  void keepStorage()
  return id
}

export async function updatePhoto(id: string, changes: { date: string; pose?: PhotoPose }): Promise<void> {
  if (changes.date > (await getToday())) throw new FutureDayError(changes.date)
  await db.photos.update(id, { date: changes.date, pose: changes.pose })
}

/** Deletes the photo from this device for good (there's no other copy). */
export async function deletePhoto(id: string): Promise<void> {
  await db.transaction('rw', db.photos, db.photoImages, async () => {
    await db.photos.delete(id)
    await db.photoImages.delete(id)
  })
}

/**
 * Ask the browser not to clear this site's storage under pressure, so photos
 * (which exist nowhere else) aren't evicted. Browsers may say no; that's fine.
 */
async function keepStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // Not supported: nothing to do.
  }
}

/** Newest day first; within a day, newest added first. */
export function sortPhotos(photos: ProgressPhoto[]): ProgressPhoto[] {
  return [...photos].sort((a, b) => (a.date === b.date ? b.addedAt - a.addedAt : a.date < b.date ? 1 : -1))
}

/** Every photo (thumbnails only), newest day first. Undefined while loading. */
export function usePhotos(): ProgressPhoto[] | undefined {
  return useLiveQuery(async () => sortPhotos(await db.photos.toArray()), [])
}

/** One photo's full image bytes (undefined while loading, null if gone). */
export function usePhotoImage(id: string | undefined): ArrayBuffer | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.photoImages.get(id))?.image ?? null) : null), [id])
}
