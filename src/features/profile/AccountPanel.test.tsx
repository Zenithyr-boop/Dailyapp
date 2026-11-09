import { act, fireEvent, render, screen } from '@testing-library/react'
import type { AuthUser } from '../../lib/auth'

// Mock the auth wrapper so tests never load the Firebase SDK or hit the network.
const mocks = vi.hoisted(() => ({
  available: true,
  listener: null as ((user: AuthUser | null) => void) | null,
  signInWithEmail: vi.fn(),
  createAccount: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendPasswordReset: vi.fn(),
  signOutUser: vi.fn(),
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
  }
})

const { AccountPanel } = await import('./AccountPanel')

const emailUser: AuthUser = { uid: 'u1', email: 'lifter@example.com', displayName: null, provider: 'password' }

function emit(user: AuthUser | null) {
  act(() => mocks.listener?.(user))
}

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code })
}

beforeEach(() => {
  mocks.available = true
  mocks.listener = null
  for (const fn of [
    mocks.signInWithEmail,
    mocks.createAccount,
    mocks.signInWithGoogle,
    mocks.sendPasswordReset,
    mocks.signOutUser,
  ]) {
    fn.mockReset().mockResolvedValue(undefined)
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

  it('shows the Google account and signs out', async () => {
    render(<AccountPanel />)
    emit({ uid: 'u2', email: 'g@example.com', displayName: 'Sam Lee', provider: 'google.com' })
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
    expect(screen.getByText('Google account')).toBeInTheDocument()
    expect(screen.getByText(/syncing between devices comes in a later update/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mocks.signOutUser).toHaveBeenCalledOnce()
    emit(null)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
