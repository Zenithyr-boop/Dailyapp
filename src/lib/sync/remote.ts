/**
 * The cloud side of sync: a small interface over Firestore so the engine can be
 * tested with a fake. Firestore itself is loaded on demand, only when signed in.
 *
 * Layout (CLAUDE.md): the profile is the `users/{uid}` document; every other
 * table is a subcollection `users/{uid}/{table}/{key}`. Each document carries
 * `syncedAt` (server time of the last write), which the listeners use as their
 * cursor so they only fetch what changed since the last sync.
 */
import type { SyncedRecord, SyncedTable } from '../db'
import { SYNCED_TABLES } from '../db'
import { getFirestoreDb } from '../firebase'
import { toCloud } from './merge'
import { countUsage } from './usage'

export interface RemoteBatch {
  records: SyncedRecord[]
  /** Highest `syncedAt` (ms) in this batch; the next cursor. */
  maxSyncedAt: number
}

export interface Upload {
  table: SyncedTable
  key: string
  record: SyncedRecord
}

export interface RemoteStore {
  /** Everything in the account (used once, on a device's first sign-in). */
  fetchAll(): Promise<Record<SyncedTable, RemoteBatch>>
  /** Live changes with `syncedAt` after `since`. Returns an unsubscribe. */
  listen(
    table: SyncedTable,
    since: number,
    onChange: (batch: RemoteBatch) => void,
    onError: (error: unknown) => void,
  ): () => void
  /** Write records in batches (≤ 450 per commit). */
  upload(items: Upload[]): Promise<void>
  /** Remove every document in the account (Delete my account). */
  deleteAll(): Promise<void>
}

const BATCH_LIMIT = 450

export async function createFirestoreRemote(uid: string): Promise<RemoteStore> {
  const fs = await import('firebase/firestore')
  const db = await getFirestoreDb()

  const userDoc = fs.doc(db, 'users', uid)
  const tableCol = (table: Exclude<SyncedTable, 'profile'>) => fs.collection(db, 'users', uid, table)
  const docRef = (table: SyncedTable, key: string) =>
    table === 'profile' ? userDoc : fs.doc(db, 'users', uid, table, key)

  const fromSnap = (data: Record<string, unknown>): { record: SyncedRecord; syncedAt: number } => {
    const ts = data.syncedAt as { toMillis?: () => number } | null | undefined
    return { record: toCloud(data) as unknown as SyncedRecord, syncedAt: ts?.toMillis?.() ?? 0 }
  }

  const toBatch = (items: { record: SyncedRecord; syncedAt: number }[]): RemoteBatch => ({
    records: items.map((i) => i.record),
    maxSyncedAt: items.reduce((m, i) => Math.max(m, i.syncedAt), 0),
  })

  return {
    async fetchAll() {
      const out = {} as Record<SyncedTable, RemoteBatch>
      for (const table of SYNCED_TABLES) {
        if (table === 'profile') {
          const snap = await fs.getDoc(userDoc)
          countUsage('reads', 1)
          out.profile = toBatch(snap.exists() ? [fromSnap(snap.data())] : [])
        } else {
          const snap = await fs.getDocs(tableCol(table))
          countUsage('reads', Math.max(1, snap.size)) // an empty query still costs one read
          out[table] = toBatch(snap.docs.map((d) => fromSnap(d.data())))
        }
      }
      return out
    },

    listen(table, since, onChange, onError) {
      if (table === 'profile') {
        return fs.onSnapshot(
          userDoc,
          (snap) => {
            if (snap.metadata.hasPendingWrites) return // our own write, not confirmed yet
            if (!snap.metadata.fromCache) countUsage('reads', 1)
            if (snap.exists()) onChange(toBatch([fromSnap(snap.data())]))
          },
          onError,
        )
      }
      const q = fs.query(
        tableCol(table),
        fs.where('syncedAt', '>', fs.Timestamp.fromMillis(since)),
        fs.orderBy('syncedAt'),
      )
      let first = true
      return fs.onSnapshot(
        q,
        (snap) => {
          const changes = snap
            .docChanges()
            .filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites)
          if (!snap.metadata.fromCache) countUsage('reads', first && changes.length === 0 ? 1 : changes.length)
          first = false
          if (changes.length) onChange(toBatch(changes.map((c) => fromSnap(c.doc.data()))))
        },
        onError,
      )
    },

    async upload(items) {
      for (let i = 0; i < items.length; i += BATCH_LIMIT) {
        const batch = fs.writeBatch(db)
        const chunk = items.slice(i, i + BATCH_LIMIT)
        for (const { table, key, record } of chunk) {
          batch.set(docRef(table, key), { ...toCloud(record), syncedAt: fs.serverTimestamp() })
        }
        await batch.commit()
        countUsage('writes', chunk.length)
      }
    },

    async deleteAll() {
      for (const table of SYNCED_TABLES) {
        if (table === 'profile') continue
        const snap = await fs.getDocs(tableCol(table))
        countUsage('reads', Math.max(1, snap.size))
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
          const batch = fs.writeBatch(db)
          const chunk = snap.docs.slice(i, i + BATCH_LIMIT)
          chunk.forEach((d) => batch.delete(d.ref))
          await batch.commit()
          countUsage('writes', chunk.length)
        }
      }
      await fs.deleteDoc(userDoc)
      countUsage('writes', 1)
    },
  }
}
