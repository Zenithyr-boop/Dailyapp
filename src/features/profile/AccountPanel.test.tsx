import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AuthUser } from '../../lib/auth'
import type { SyncStatus } from '../../lib/sync/engine'

// Mock the auth wrapper and the sync engine so tests never load Firebase or hit the network.
const mocks = vi.hoisted(() => ({
  available: true,
  listener: null as ((user: AuthUser | null) => void) | null,
  signInWithEmail: vi.fn(),
  createAccount: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendPasswordReset: vi.fn(),
  signOutUser: vi.fn(),
  reauthenticate: vi.fn(),
  deleteCurrentUser: vi.fn(),
  // Sync engine
  status: { state: 'synced', pending: 0 } as SyncStatus,
  statusListeners: new Set<() => void>(),
  pendingOnSignOut: 0,
  stopSync: vi.fn(),
  clearLocalData: vi.fn(),
  deleteCloudData: vi.fn(),
  syncNow: vi.fn(),
  /** Order in which the mocked actions ran. */
  calls: [] as string[],
}))

vi.mock('../../lib/auth', async () => {
  const { authErrorMessage } = await vi.importActual<typeof import('../../lib/auth')>('../../lib/auth')
  return {
    get authAvailable() {
      return mocks.available
    },
    authErrorMessage,
    watchAuth: (cb: (user: AuthUser | null) => void) => {
      mocks.listener = cb
      return () => {
        mocks.listener = null
      }
    },
    signInWithEmail: mocks.signInWithEmail,
    createAccount: mocks.createAccount,
    signInWithGoogle: mocks.signInWithGoogle,
    sendPasswordReset: mocks.sendPasswordReset,
    signOutUser: mocks.signOutUser,
    reauthenticate: mocks.reauthenticate,
    deleteCurrentUser: mocks.deleteCurrentUser,
  }
})

vi.mock('../../lib/sync/engine', () => ({
  getSyncStatus: () => mocks.status,
  subscribeSyncStatus: (fn: () => void) => {
    mocks.statusListeners.add(fn)
    return () => mocks.statusListeners.delete(fn)
  },
  flushBeforeSignOut: () => Promise.resolve(mocks.pendingOnSignOut),
  stopSync: mocks.stopSync,
  clearLocalData: mocks.clearLocalData,
  deleteCloudData: mocks.deleteCloudData,
  syncNow: mocks.syncNow,
}))

vi.mock('./accountSync', () => ({ syncOptions: { createRemote: vi.fn() } }))

const { AccountPanel } = await import('./AccountPanel')

const emailUser: AuthUser = { uid: 'u1', email: 'lifter@example.com', displayName: null, provider: 'password' }

function emit(user: AuthUser | null) {
  act(() => mocks.listener?.(user))
}

function setStatus(status: SyncStatus) {
  act(() => {
    mocks.status = status
    mocks.statusListeners.forEach((fn) => fn())
  })
}

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code })
}

beforeEach(() => {
  mocks.available = true
  mocks.listener = null
  mocks.status = { state: 'synced', pending: 0, lastSyncedAt: Date.now() }
  mocks.pendingOnSignOut = 0
  mocks.calls = []
  const actions = {
    signInWithEmail: mocks.signInWithEmail,
    createAccount: mocks.createAccount,
    signInWithGoogle: mocks.signInWithGoogle,
    sendPasswordReset: mocks.sendPasswordReset,
    signOutUser: mocks.signOutUser,
    reauthenticate: mocks.reauthenticate,
    deleteCurrentUser: mocks.deleteCurrentUser,
    stopSync: mocks.stopSync,
    clearLocalData: mocks.clearLocalData,
    deleteCloudData: mocks.deleteCloudData,
    syncNow: mocks.syncNow,
  }
  for (const [name, fn] of Object.entries(actions)) {
    fn.mockReset().mockImplementation(async () => {
      mocks.calls.push(name)
    })
  }
})

describe('AccountPanel', () => {
  it('says sign-in is not set up when the build has no Firebase config', () => {
    mocks.available = false
    render(<AccountPanel />)
    expect(screen.getByText(/sign-in isn’t set up/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('shows a loading state until Firebase reports', () => {
    render(<AccountPanel />)
    expect(screen.getByRole('status')).toHaveTextContent(/checking sign-in/i)
  })

  it('shows the sign-in options when signed out', () => {
    render(<AccountPanel />)
    emit(null)
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText(/works fully without an account/i)).toBeInTheDocument()
  })

  it('signs in with email and password', async () => {
    render(<AccountPanel />)
    emit(null)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lifter@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(mocks.signInWithEmail).toHaveBeenCalledWith('lifter@example.com', 'secret123')

    emit(emailUser)
    expect(screen.getByText('lifter@example.com')).toBeInTheDocument()
    expect(screen.getByText('Email account')).toBeInTheDocument()
  })

  it('creates an account', async () => {
    render(<AccountPanel />)
    emit(null)
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(mocks.createAccount).toHaveBeenCalledWith('new@example.com', 'secret123')
  })

  it('shows a readable error when sign-in fails', async () => {
    mocks.signInWithEmail.mockRejectedValue(firebaseError('auth/invalid-credential'))
    render(<AccountPanel />)
    emit(null)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lifter@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong.')
  })

  it('starts Google sign-in and stays quiet if the popup is closed', async () => {
    mocks.signInWithGoogle.mockRejectedValue(firebaseError('auth/popup-closed-by-user'))
    render(<AccountPanel />)
    emit(null)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(mocks.signInWithGoogle).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for an email before sending a password reset', async () => {
    render(<AccountPanel />)
    emit(null)
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your email/i)
    expect(mocks.sendPasswordReset).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lifter@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(mocks.sendPasswordReset).toHaveBeenCalledWith('lifter@example.com')
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument()
  })

  it('shows the Google account and its sync status', () => {
    render(<AccountPanel />)
    emit({ uid: 'u2', email: 'g@example.com', displayName: 'Sam Lee', provider: 'google.com' })
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
    expect(screen.getByText('Google account')).toBeInTheDocument()
    expect(screen.getByText('Synced · just now')).toBeInTheDocument()
    expect(screen.getByText(/today on this device: \d+ reads · \d+ writes/i)).toBeInTheDocument()
  })
})

describe('sync status', () => {
  it('shows offline with the number of waiting changes', () => {
    render(<AccountPanel />)
    emit(emailUser)
    setStatus({ state: 'offline', pending: 3 })
    expect(screen.getByText('Offline, will sync')).toBeInTheDocument()
    expect(screen.getByText('3 changes waiting to upload')).toBeInTheDocument()
  })

  it('shows a sync error with a Retry button', () => {
    render(<AccountPanel />)
    emit(emailUser)
    setStatus({ state: 'error', pending: 1, error: 'permission-denied' })
    expect(screen.getByText('Sync error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.syncNow).toHaveBeenCalledOnce()
  })
})

describe('signing out', () => {
  async function openSignOut() {
    render(<AccountPanel />)
    emit(emailUser)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out' })
    await within(dialog).findByRole('radio', { name: /keep it on this device/i })
    return dialog
  }

  it('keeps the data on this device by default', async () => {
    const dialog = await openSignOut()
    expect(within(dialog).getByRole('radio', { name: /keep it/i })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
    await vi.waitFor(() => expect(mocks.signOutUser).toHaveBeenCalledOnce())
    expect(mocks.calls).toEqual(['stopSync', 'signOutUser'])

    emit(null)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('can remove the data from this device', async () => {
    const dialog = await openSignOut()
    fireEvent.click(within(dialog).getByRole('radio', { name: /remove it/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
    await vi.waitFor(() => expect(mocks.signOutUser).toHaveBeenCalledOnce())
    expect(mocks.calls).toEqual(['stopSync', 'clearLocalData', 'signOutUser'])
  })

  it('warns when changes have not reached the cloud', async () => {
    mocks.pendingOnSignOut = 2
    const dialog = await openSignOut()
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/2 changes haven’t reached the cloud/)
    expect(within(dialog).getByText(/except 2 changes not uploaded yet, which will be lost/)).toBeInTheDocument()
  })

  it('can be cancelled', async () => {
    const dialog = await openSignOut()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.signOutUser).not.toHaveBeenCalled()
  })
})

describe('deleting the account', () => {
  function openDelete(user: AuthUser = emailUser) {
    render(<AccountPanel />)
    emit(user)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    return screen.getByRole('dialog', { name: 'Delete my account' })
  }

  it('needs DELETE typed and the password before it runs', async () => {
    const dialog = openDelete()
    const submit = within(dialog).getByRole('button', { name: 'Delete my account' })
    expect(submit).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } })
    expect(submit).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Your password'), { target: { value: 'secret123' } })
    expect(submit).toBeEnabled()

    fireEvent.click(submit)
    await vi.waitFor(() => expect(mocks.deleteCurrentUser).toHaveBeenCalledOnce())
    expect(mocks.reauthenticate).toHaveBeenCalledWith('secret123')
    expect(mocks.deleteCloudData).toHaveBeenCalledWith('u1', expect.any(Function))
    // Confirm identity first, then the cloud data, then the sign-in account.
    expect(mocks.calls).toEqual(['reauthenticate', 'deleteCloudData', 'deleteCurrentUser'])
  })

  it('asks Google accounts to pick their account again and can clear this device', async () => {
    const dialog = openDelete({ uid: 'g1', email: 'g@example.com', displayName: 'Sam', provider: 'google.com' })
    expect(within(dialog).queryByLabelText('Your password')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: /remove it/i }))
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }))
    await vi.waitFor(() => expect(mocks.deleteCurrentUser).toHaveBeenCalledOnce())
    expect(mocks.reauthenticate).toHaveBeenCalledWith(undefined)
    expect(mocks.calls).toEqual(['reauthenticate', 'deleteCloudData', 'clearLocalData', 'deleteCurrentUser'])
  })

  it('deletes nothing when confirming identity fails', async () => {
    mocks.reauthenticate.mockRejectedValue(firebaseError('auth/invalid-credential'))
    const dialog = openDelete()
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })
    fireEvent.change(within(dialog).getByLabelText('Your password'), { target: { value: 'wrong' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Email or password is wrong.')
    expect(mocks.deleteCloudData).not.toHaveBeenCalled()
    expect(mocks.deleteCurrentUser).not.toHaveBeenCalled()
  })
})
