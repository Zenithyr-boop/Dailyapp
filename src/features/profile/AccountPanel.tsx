import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Panel } from '../../components/Panel'
import {
  authErrorMessage,
  createAccount,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  type AuthUser,
} from '../../lib/auth'
import { useAuth } from './useAuth'

const SYNC_NOTE = 'Your data stays on this device. Syncing between devices comes in a later update.'

/** Account box on the Me screen: optional sign-in. The app works fully without it. */
export function AccountPanel() {
  const auth = useAuth()

  if (auth.status === 'unavailable') {
    return (
      <Panel title="Account">
        <p className="text-muted">Sign-in isn’t set up in this build. Everything else works offline on this device.</p>
      </Panel>
    )
  }

  if (auth.status === 'loading') {
    return (
      <Panel title="Account">
        <p className="text-muted" role="status">
          Checking sign-in…
        </p>
      </Panel>
    )
  }

  if (auth.status === 'signed-in') return <SignedIn user={auth.user} />
  return <SignedOut />
}

function SignedIn({ user }: { user: AuthUser }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    try {
      await signOutUser()
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Panel title="Account" aside="Signed in">
      <div className="space-y-4">
        <div>
          <p className="font-display text-xl font-bold break-all">{user.displayName ?? user.email}</p>
          {user.displayName && user.email && <p className="text-muted break-all">{user.email}</p>}
          <p className="label mt-1">{user.provider === 'google.com' ? 'Google account' : 'Email account'}</p>
        </div>
        <p className="text-muted">{SYNC_NOTE}</p>
        {error && (
          <p role="alert" className="border-l-2 border-accent pl-3 text-text">
            {error}
          </p>
        )}
        <Button variant="secondary" onClick={handleSignOut} disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </Panel>
  )
}

type Mode = 'sign-in' | 'create'

function SignedOut() {
  const id = useId()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      if (success) setNotice(success)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => (mode === 'sign-in' ? signInWithEmail(email, password) : createAccount(email, password)))
  }

  function handleReset() {
    if (!email.trim()) {
      setNotice(null)
      setError('Enter your email address first.')
      return
    }
    void run(() => sendPasswordReset(email), `If there’s an account for ${email.trim()}, a reset link is on its way.`)
  }

  function switchMode() {
    setMode(mode === 'sign-in' ? 'create' : 'sign-in')
    setError(null)
    setNotice(null)
  }

  const creating = mode === 'create'

  return (
    <Panel title="Account" aside="Optional">
      <div className="space-y-4">
        <p className="text-muted">
          FromZero works fully without an account. Sign in to keep your progress safe when syncing arrives.
        </p>

        <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void run(signInWithGoogle)}>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="label">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" aria-label={creating ? 'Create account' : 'Sign in with email'}>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-email`} className="label block">
              Email
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-touch w-full border border-line bg-bg px-3 text-text outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-password`} className="label block">
              Password
            </label>
            <input
              id={`${id}-password`}
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              required
              minLength={creating ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={creating ? `${id}-password-hint` : undefined}
              className="min-h-touch w-full border border-line bg-bg px-3 text-text outline-none focus:border-accent"
            />
            {creating && (
              <p id={`${id}-password-hint`} className="text-sm text-muted">
                At least 6 characters.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-accent pl-3 text-text">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="border-l-2 border-accent pl-3 text-text">
              {notice}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'One moment…' : creating ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="flex flex-wrap justify-between gap-x-4">
          <button
            type="button"
            onClick={switchMode}
            disabled={busy}
            className="min-h-touch text-left text-accent hover:text-text disabled:opacity-40"
          >
            {creating ? 'Have an account? Sign in' : 'New here? Create an account'}
          </button>
          {!creating && (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              className="min-h-touch text-left text-muted hover:text-accent disabled:opacity-40"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </Panel>
  )
}
