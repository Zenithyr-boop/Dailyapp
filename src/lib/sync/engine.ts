/**
 * Account sync engine. Dexie stays the source of truth on the device; Firestore
 * holds the copy in the cloud. Runs only while signed in.
 *
 * - Upload: local writes are flagged `dirty` (see db.ts hooks). A watcher
 *   debounces them (2 s) and uploads them in batches; while offline they wait.
 * - Download: one Firestore listener per table, starting from a cursor (the
 *   newest `syncedAt` seen), so opening the app only fetches what changed.
 * - Conflicts: `resolveIncoming` in merge.ts.
 * - First sign-in on a device: see `firstSignIn`.
 */
import { liveQuery, type Subscription } from 'dexie'
import {
  db,
  getMeta,
  recordKey,
  runAsSync,
  setMeta,
  SYNCED_TABLES,
  type QuestDef,
  type SyncedRecord,
  type SyncedTable,
} from '../db'
import { isPristine, matchQuests, remapDay, resolveIncoming, type DefaultQuest } from './merge'
import type { RemoteBatch, RemoteStore, Upload } from './remote'

export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Local changes waiting to be uploaded. */
  pending: number
  /** Last time this device was fully in step with the cloud (ms). */
  lastSyncedAt?: number
  error?: string
}

export interface SyncOptions {
  createRemote: (uid: string) => Promise<RemoteStore>
  /** The starter quests, to recognise an untouched device on first sign-in. */
  defaultQuests: readonly DefaultQuest[]
  /** Called after cloud changes to days were applied (e.g. to update milestones). */
  afterRemoteChange?: () => Promise<void>
  debounceMs?: number
}

const UPLOAD_LIMIT = 450
const RETRY_DELAYS = [5_000, 30_000, 120_000, 300_000]
const SYNC_UID = 'syncUid'
const LAST_SYNCED = 'lastSyncedAt'
const cursorKey = (table: SyncedTable) => `cursor:${table}`

// ---- Status store (read by the Me screen via useSyncExternalStore) ----------

let status: SyncStatus = { state: 'off', pending: 0 }
const statusListeners = new Set<() => void>()

function setStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next }
  statusListeners.forEach((fn) => fn())
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(fn: () => void): () => void {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

// ---- Session -----------------------------------------------------------------

class SyncSession {
  private remote: RemoteStore | undefined
  private stopped = false
  private unsubscribers: (() => void)[] = []
  private dirtyWatch: Subscription | undefined
  private debounceTimer: ReturnType<typeof setTimeout> | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private retryIndex = 0
  private flushing: Promise<void> | undefined
  private flushAgain = false
  /** Cloud batches are applied one at a time, in order. */
  private applyQueue: Promise<void> = Promise.resolve()
  private listenerError = false

  readonly uid: string
  private readonly options: SyncOptions

  constructor(uid: string, options: SyncOptions) {
    this.uid = uid
    this.options = options
  }

  async start(): Promise<void> {
    setStatus({ state: 'syncing', error: undefined, lastSyncedAt: await getMeta<number>(LAST_SYNCED) })
    try {
      const remote = await this.options.createRemote(this.uid)
      if (this.stopped) return
      // Only remember the remote once first sign-in succeeded, so a retry redoes it.
      if ((await getMeta<string>(SYNC_UID)) !== this.uid) await this.firstSignIn(remote)
      if (this.stopped) return
      this.remote = remote
      await this.startListeners()
      this.watchDirty()
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
      await this.flush()
    } catch (error) {
      this.fail(error)
    }
  }

  stop(): void {
    this.stopped = true
    this.unsubscribers.forEach((u) => u())
    this.unsubscribers = []
    this.dirtyWatch?.unsubscribe()
    clearTimeout(this.debounceTimer)
    clearTimeout(this.retryTimer)
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
  }

  /** Upload now and, if a listener failed, reconnect. */
  async retry(): Promise<void> {
    clearTimeout(this.retryTimer)
    this.retryIndex = 0
    if (!this.remote) return this.start()
    if (this.listenerError) {
      this.unsubscribers.forEach((u) => u())
      this.unsubscribers = []
      this.listenerError = false
      await this.startListeners()
    }
    await this.flush()
  }

  // -- Upload --

  private watchDirty(): void {
    this.dirtyWatch = liveQuery(() =>
      Promise.all(SYNCED_TABLES.map((t) => db.table(t).where('dirty').equals(1).count())),
    ).subscribe({
      next: (counts) => {
        const pending = counts.reduce((a, b) => a + b, 0)
        setStatus({ pending })
        if (pending > 0) {
          clearTimeout(this.debounceTimer)
          this.debounceTimer = setTimeout(() => void this.flush(), this.options.debounceMs ?? 2000)
        }
      },
      error: (error) => this.fail(error),
    })
  }

  flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true
      return this.flushing
    }
    this.flushing = this.doFlush().finally(() => {
      this.flushing = undefined
      if (this.flushAgain && !this.stopped) {
        this.flushAgain = false
        void this.flush()
      }
    })
    return this.flushing
  }

  private async doFlush(): Promise<void> {
    if (this.stopped || !this.remote) return
    if (!isOnline()) {
      setStatus({ state: 'offline' })
      return
    }
    try {
      for (;;) {
        const items = await collectDirty()
        if (!items.length || this.stopped) break
        setStatus({ state: 'syncing' })
        await this.remote.upload(items)
        await clearDirty(items)
      }
      if (this.stopped) return
      const now = Date.now()
      await setMeta(LAST_SYNCED, now)
      this.retryIndex = 0
      setStatus({ state: this.listenerError ? 'error' : 'synced', lastSyncedAt: now, error: undefined })
    } catch (error) {
      this.fail(error)
    }
  }

  private fail(error: unknown): void {
    if (this.stopped) return
    console.warn('[sync] error', error)
    if (!isOnline()) {
      setStatus({ state: 'offline' })
      return
    }
    setStatus({ state: 'error', error: error instanceof Error ? error.message : String(error) })
    const delay = RETRY_DELAYS[Math.min(this.retryIndex++, RETRY_DELAYS.length - 1)]
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => void this.retry(), delay)
  }

  private handleOnline = () => void this.retry()
  private handleOffline = () => setStatus({ state: 'offline' })

  // -- Download --

  private async startListeners(): Promise<void> {
    for (const table of SYNCED_TABLES) {
      const since = (await getMeta<number>(cursorKey(table))) ?? 0
      const unsub = this.remote!.listen(
        table,
        since,
        (batch) => this.enqueueApply(table, batch),
        (error) => {
          this.listenerError = true
          this.fail(error)
        },
      )
      this.unsubscribers.push(unsub)
    }
  }

  private enqueueApply(table: SyncedTable, batch: RemoteBatch): void {
    this.applyQueue = this.applyQueue
      .then(async () => {
        if (this.stopped) return
        await applyBatch(table, batch)
        if (table === 'days') await this.options.afterRemoteChange?.()
      })
      .catch((error) => this.fail(error))
  }

  // -- First sign-in --

  /**
   * First time this device syncs with this account:
   * - account empty → upload everything on this device;
   * - this device untouched (only starter quests) → take the account's data;
   * - both have data → match starter quests by name, then merge every record
   *   with the normal rules. Nothing is thrown away.
   */
  private async firstSignIn(remote: RemoteStore): Promise<void> {
    const cloud = await remote.fetchAll()
    if (this.stopped) return
    const cloudCount = SYNCED_TABLES.reduce((n, t) => n + cloud[t].records.length, 0)

    if (cloudCount === 0) {
      await markAllDirty()
    } else {
      const [profile, quests, days, otherRecords] = await Promise.all([
        db.profile.get('me'),
        db.quests.toArray(),
        db.days.toArray(),
        Promise.all((['workouts', 'sessions', 'food', 'programs'] as const).map((t) => db.table(t).count())).then(
          (c) => c.reduce((a, b) => a + b, 0),
        ),
      ])
      const pristine = isPristine({ profile, quests, days, otherRecords }, this.options.defaultQuests)

      if (pristine) {
        await runAsSync(async () => {
          await db.quests.clear()
          await db.days.clear()
          for (const table of SYNCED_TABLES) {
            await db.table(table).bulkPut(cloud[table].records.map((r) => ({ ...r, dirty: 0 })))
          }
          // An account without a profile document keeps (and uploads) this device's.
          if (!cloud.profile.records.length) await db.profile.toCollection().modify({ dirty: 1 })
        })
      } else {
        const ids = matchQuests(quests, cloud.quests.records as unknown as QuestDef[])
        await runAsSync(async () => {
          await db.quests.bulkDelete([...ids.keys()])
          await db.days.bulkPut(days.map((d) => remapDay(d, ids)))
        })
        await markAllDirty()
        for (const table of SYNCED_TABLES) await applyBatch(table, cloud[table], { preferRemote: true })
      }
      await this.options.afterRemoteChange?.()
    }

    for (const table of SYNCED_TABLES) await setMeta(cursorKey(table), cloud[table].maxSyncedAt)
    await setMeta(SYNC_UID, this.uid)
  }
}

// ---- Dexie helpers -------------------------------------------------------------

async function collectDirty(): Promise<Upload[]> {
  const items: Upload[] = []
  for (const table of SYNCED_TABLES) {
    if (items.length >= UPLOAD_LIMIT) break
    const records = (await db.table(table).where('dirty').equals(1).limit(UPLOAD_LIMIT - items.length).toArray()) as SyncedRecord[]
    for (const record of records) items.push({ table, key: recordKey(table, record), record })
  }
  return items
}

/** Clear the flag only if the record didn't change again during the upload. */
async function clearDirty(items: Upload[]): Promise<void> {
  await runAsSync(async () => {
    for (const { table, key, record } of items) {
      const current = (await db.table(table).get(key)) as SyncedRecord | undefined
      if (current?.dirty === 1 && current.updatedAt === record.updatedAt) {
        await db.table(table).put({ ...current, dirty: 0 })
      }
    }
  })
}

async function markAllDirty(): Promise<void> {
  await runAsSync(async () => {
    for (const table of SYNCED_TABLES) await db.table(table).toCollection().modify({ dirty: 1 })
  })
}

/** Merge a batch of cloud records into Dexie and move the cursor forward. */
export async function applyBatch(
  table: SyncedTable,
  batch: RemoteBatch,
  { preferRemote = false }: { preferRemote?: boolean } = {},
): Promise<void> {
  await runAsSync(async () => {
    const t = db.table(table)
    for (const remote of batch.records) {
      const key = recordKey(table, remote)
      const local = (await t.get(key)) as SyncedRecord | undefined
      const { record, upload } = resolveIncoming(table, local, remote, { preferRemote })
      await t.put({ ...record, dirty: upload ? 1 : 0 })
    }
    const cursor = (await getMeta<number>(cursorKey(table))) ?? 0
    if (batch.maxSyncedAt > cursor) await setMeta(cursorKey(table), batch.maxSyncedAt)
  })
}

// ---- Public API -----------------------------------------------------------------

let session: SyncSession | undefined

/** Start syncing for this account (no-op if already running for it). */
export function startSync(uid: string, options: SyncOptions): void {
  if (session?.uid === uid) return
  stopSync()
  session = new SyncSession(uid, options)
  void session.start()
}

export function stopSync(): void {
  session?.stop()
  session = undefined
  setStatus({ state: 'off', error: undefined })
}

/** "Retry" on the Me screen. */
export async function syncNow(): Promise<void> {
  await session?.retry()
}

/** Changes on this device that haven't reached the cloud yet. */
export async function countPending(): Promise<number> {
  const counts = await Promise.all(SYNCED_TABLES.map((t) => db.table(t).where('dirty').equals(1).count()))
  return counts.reduce((a, b) => a + b, 0)
}

/** Try to upload everything before signing out. Resolves with what's still pending. */
export async function flushBeforeSignOut(timeoutMs = 8000): Promise<number> {
  if (session && isOnline()) {
    await Promise.race([session.flush(), new Promise((r) => setTimeout(r, timeoutMs))])
  }
  return countPending()
}

/** Forget which account this device last synced with (its next sign-in is a first sign-in). */
export async function forgetAccountLink(): Promise<void> {
  await runAsSync(async () => {
    await setMeta(SYNC_UID, undefined)
    await setMeta(LAST_SYNCED, undefined)
    for (const table of SYNCED_TABLES) await setMeta(cursorKey(table), undefined)
  })
}

/** Remove every record from this device ("Remove data from this device"). */
export async function clearLocalData(): Promise<void> {
  stopSync()
  await runAsSync(async () => {
    for (const table of SYNCED_TABLES) await db.table(table).clear()
    await db.meta.clear()
  })
}

/** Delete the account's cloud data (Delete my account). The caller then deletes the sign-in. */
export async function deleteCloudData(uid: string, createRemote: SyncOptions['createRemote']): Promise<void> {
  stopSync()
  const remote = await createRemote(uid)
  await remote.deleteAll()
  await forgetAccountLink()
}
