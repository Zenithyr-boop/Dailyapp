import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Panel } from '../../components/Panel'
import { authErrorMessage, deleteCurrentUser, reauthenticate, signOutUser, type AuthUser } from '../../lib/auth'
import { clearLocalData, deleteCloudData, flushBeforeSignOut, stopSync, syncNow } from '../../lib/sync/engine'
import { syncOptions } from './accountSync'
import { timeAgo, useNow, useSyncStatus, useSyncUsage } from './useSyncStatus'

/** Account box while signed in: who, sync status, sign out, delete account. */
export function SignedInPanel({ user }: { user: AuthUser }) {
  const [dialog, setDialog] = useState<'sign-out' | 'delete' | null>(null)

  return (
    <Panel title="Account" aside="Signed in">
      <div className="space-y-4">
        <div>
          <p className="font-display text-xl font-bold break-all">{user.displayName ?? user.email}</p>
          {user.displayName && user.email && <p className="text-muted break-all">{user.email}</p>}
          <p className="label mt-1">{user.provider === 'google.com' ? 'Google account' : 'Email account'}</p>
        </div>

        <SyncStatusLine />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => setDialog('sign-out')} className="w-full sm:w-auto">
            Sign out
          </Button>
          <button
            type="button"
            onClick={() => setDialog('delete')}
            className="min-h-touch text-left text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Delete my account
          </button>
        </div>
      </div>

      {dialog === 'sign-out' && <SignOutDialog onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteAccountDialog user={user} onClose={() => setDialog(null)} />}
    </Panel>
  )
}

function SyncStatusLine() {
  const status = useSyncStatus()
  const usage = useSyncUsage()
  const now = useNow()
  const [retrying, setRetrying] = useState(false)

  let text: string
  switch (status.state) {
    case 'synced':
      text = status.lastSyncedAt ? `Synced · ${timeAgo(status.lastSyncedAt, now)}` : 'Synced'
      break
    case 'offline':
      text = 'Offline, will sync'
      break
    case 'error':
      text = 'Sync error'
      break
    case 'syncing':
      text = 'Syncing…'
      break
    default:
      text = 'Sync paused'
  }

  async function retry() {
    setRetrying(true)
    await syncNow()
    setRetrying(false)
  }

  return (
    <div className="border-l-2 border-accent pl-3">
      <div className="flex flex-wrap items-center gap-x-4">
        <p role="status" className="font-display text-lg font-semibold uppercase tracking-wider">
          {text}
        </p>
        {status.state === 'error' && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="min-h-touch font-display font-bold uppercase tracking-wider text-accent hover:text-text disabled:opacity-40"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
      {status.pending > 0 && status.state !== 'syncing' && (
        <p className="text-sm text-muted">
          {status.pending} {status.pending === 1 ? 'change' : 'changes'} waiting to upload
        </p>
      )}
      <p className="text-sm text-muted">
        Today on this device: {usage.reads} reads · {usage.writes} writes
      </p>
    </div>
  )
}

type DeviceChoice = 'keep' | 'clear'

function DeviceDataChoice({ value, onChange, pending }: { value: DeviceChoice; onChange: (v: DeviceChoice) => void; pending: number }) {
  const name = useId()
  return (
    <fieldset className="space-y-1">
      <legend className="label mb-1">Data on this device</legend>
      {(
        [
          ['keep', 'Keep it on this device', 'Quests and history stay here. Sign in again to sync them.'],
          [
            'clear',
            'Remove it from this device',
            pending > 0
              ? `Your account keeps a copy, except ${pending} ${pending === 1 ? 'change' : 'changes'} not uploaded yet, which will be lost.`
              : 'Your account keeps a copy in the cloud.',
          ],
        ] as const
      ).map(([v, label, hint]) => (
        <label key={v} className="flex min-h-touch cursor-pointer items-start gap-3 py-1.5">
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="mt-1 size-5 shrink-0 accent-accent"
          />
          <span>
            <span className="block text-text">{label}</span>
            <span className="block text-sm text-muted">{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function SignOutDialog({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState<number | null>(null)
  const [choice, setChoice] = useState<DeviceChoice>('keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload what's waiting first, so signing out loses nothing when online.
  useEffect(() => {
    let live = true
    void flushBeforeSignOut().then((n) => live && setPending(n))
    return () => {
      live = false
    }
  }, [])

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    try {
      stopSync()
      if (choice === 'clear') await clearLocalData()
      await signOutUser()
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Dialog title="Sign out" onClose={onClose} busy={busy}>
      {pending === null ? (
        <p role="status" className="text-muted">
          Uploading your latest changes…
        </p>
      ) : (
        <>
          {pending > 0 && (
            <p role="alert" className="border-l-2 border-accent pl-3 text-text">
              {pending} {pending === 1 ? 'change hasn’t' : 'changes haven’t'} reached the cloud yet (no connection).
              Keep the data on this device so nothing is lost.
            </p>
          )}
          <DeviceDataChoice value={choice} onChange={setChoice} pending={pending} />
        </>
      )}
      {error && (
        <p role="alert" className="border-l-2 border-accent pl-3 text-text">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSignOut} disabled={busy || pending === null}>
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </Dialog>
  )
}

function DeleteAccountDialog({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const id = useId()
  const isGoogle = user.provider === 'google.com'
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [choice, setChoice] = useState<DeviceChoice>('keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = confirmText.trim().toUpperCase() === 'DELETE' && (isGoogle || password.length > 0)

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      // Firebase needs a fresh sign-in before deleting; do it first so nothing
      // is deleted if the user backs out.
      await reauthenticate(isGoogle ? undefined : password)
      await deleteCloudData(user.uid, syncOptions.createRemote)
      if (choice === 'clear') await clearLocalData()
      await deleteCurrentUser()
    } catch (err) {
      const message = authErrorMessage(err)
      setError(message ?? null)
      setBusy(false)
    }
  }

  return (
    <Dialog title="Delete my account" onClose={onClose} busy={busy}>
      <form onSubmit={handleDelete} className="space-y-4">
        <p className="text-text">
          This permanently deletes your FromZero account and everything stored in the cloud. It can’t be undone.
        </p>
        <DeviceDataChoice value={choice} onChange={setChoice} pending={0} />
        <div className="space-y-1.5">
          <label htmlFor={`${id}-confirm`} className="label block">
            Type DELETE to confirm
          </label>
          <input
            id={`${id}-confirm`}
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="min-h-touch w-full border border-line bg-bg px-3 text-text outline-none focus:border-accent"
          />
        </div>
        {!isGoogle && (
          <div className="space-y-1.5">
            <label htmlFor={`${id}-password`} className="label block">
              Your password
            </label>
            <input
              id={`${id}-password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-touch w-full border border-line bg-bg px-3 text-text outline-none focus:border-accent"
            />
          </div>
        )}
        {isGoogle && <p className="text-sm text-muted">Google will ask you to pick your account once more.</p>}
        {error && (
          <p role="alert" className="border-l-2 border-accent pl-3 text-text">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready || busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
