import { db } from './db'
import { forceRefresh } from './forceRefresh'

/*
 * Force refresh must only ever drop the app's files (service worker + Cache Storage).
 * Everything the user logged (Dexie), the Firebase sign-in (its own IndexedDB database)
 * and localStorage must survive it.
 */

const FIREBASE_DB = 'firebaseLocalStorageDb'
const FIREBASE_STORE = 'firebaseLocalStorage'
const SIGN_IN_KEY = 'firebase:authUser:key:[DEFAULT]'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Opens Firebase Auth's IndexedDB database the way the Firebase SDK lays it out. */
async function openFirebaseDb(): Promise<IDBDatabase> {
  const open = indexedDB.open(FIREBASE_DB, 1)
  open.onupgradeneeded = () => open.result.createObjectStore(FIREBASE_STORE, { keyPath: 'fbase_key' })
  return request(open)
}

async function readSignIn(): Promise<unknown> {
  const fdb = await openFirebaseDb()
  try {
    return await request(fdb.transaction(FIREBASE_STORE).objectStore(FIREBASE_STORE).get(SIGN_IN_KEY))
  } finally {
    fdb.close()
  }
}

let cacheNames: string[]
let unregister: ReturnType<typeof vi.fn>

beforeEach(async () => {
  await db.delete()
  await db.open()

  // The user's data: a day record and their profile.
  await db.days.put({ date: '2026-11-15', quests: [], weightKg: 81.4 } as never)
  await db.profile.put({ id: 'me', displayName: 'Sam' } as never)

  // A signed-in Firebase user.
  const fdb = await openFirebaseDb()
  await request(
    fdb.transaction(FIREBASE_STORE, 'readwrite').objectStore(FIREBASE_STORE).put({ fbase_key: SIGN_IN_KEY, value: { uid: 'u1' } }),
  )
  fdb.close()

  localStorage.setItem('fromzero.dayStartHour', '4')

  // The app's files: a service worker and its caches.
  cacheNames = ['workbox-precache-v2-https://fromzero.app/', 'movement-photos']
  vi.stubGlobal('caches', {
    keys: vi.fn(async () => [...cacheNames]),
    delete: vi.fn(async (name: string) => {
      cacheNames = cacheNames.filter((n) => n !== name)
      return true
    }),
  })
  unregister = vi.fn(async () => true)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: vi.fn(async () => [{ unregister }]) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  localStorage.clear()
})

describe('forceRefresh', () => {
  it('drops the service worker and the cached files, then reloads', async () => {
    const reload = vi.fn()
    await forceRefresh({ reload })
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(cacheNames).toEqual([])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("never deletes the user's data or sign-in", async () => {
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase')
    const clearStorage = vi.spyOn(Storage.prototype, 'clear')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    await forceRefresh({ reload: () => {} })

    expect(deleteDatabase).not.toHaveBeenCalled()
    expect(clearStorage).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    // Dexie: still there and unchanged.
    expect(db.isOpen()).toBe(true)
    expect(await db.days.get('2026-11-15')).toMatchObject({ weightKg: 81.4 })
    expect(await db.profile.get('me')).toMatchObject({ displayName: 'Sam' })
    // Firebase sign-in: still there.
    expect(await readSignIn()).toEqual({ fbase_key: SIGN_IN_KEY, value: { uid: 'u1' } })
    expect(localStorage.getItem('fromzero.dayStartHour')).toBe('4')
  })

  it('still reloads when the browser has no service worker or Cache Storage', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.stubGlobal('caches', undefined)
    const reload = vi.fn()
    await forceRefresh({ reload })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(await db.days.count()).toBe(1)
  })
})
