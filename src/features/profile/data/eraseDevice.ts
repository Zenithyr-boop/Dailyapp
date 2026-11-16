import { db } from '../../../lib/db'
import { clearLocalData } from '../../../lib/sync/engine'

/**
 * "Erase everything on this device" (signed out): every synced table, device-only
 * data (photos, product cache, meta) and the cached day-start hour. The next open
 * starts fresh at /welcome.
 */
export async function eraseDevice(): Promise<void> {
  await clearLocalData()
  await db.transaction('rw', db.photos, db.photoImages, async () => {
    await db.photos.clear()
    await db.photoImages.clear()
  })
  try {
    localStorage.clear()
  } catch {
    // Storage blocked: nothing to clear.
  }
}
