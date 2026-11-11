import { authErrorMessage, reauthenticate, signInWithGoogle, signOutUser } from './auth'

// The Android app: Google sign-in goes through the native plugin, then the Firebase web SDK.
const m = vi.hoisted(() => ({
  nativeSignIn: vi.fn(),
  nativeSignOut: vi.fn(async () => {}),
  signInWithCredential: vi.fn(async () => {}),
  reauthenticateWithCredential: vi.fn(async () => {}),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(async () => {}),
  user: { uid: 'u1', email: 'a@b.c' },
}))

vi.mock('./platform', () => ({ isNativeApp: () => true, isAndroidApp: () => true }))
vi.mock('./firebase', () => ({ isFirebaseConfigured: true, getFirebaseAuth: async () => ({ currentUser: m.user }) }))
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: m.nativeSignIn, signOut: m.nativeSignOut },
}))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(vi.fn(), { credential: (idToken: string) => ({ providerId: 'google.com', idToken }) }),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithPopup: vi.fn(),
  signInWithCredential: m.signInWithCredential,
  reauthenticateWithCredential: m.reauthenticateWithCredential,
  signInWithPopup: m.signInWithPopup,
  signOut: m.signOut,
}))

beforeEach(() => vi.clearAllMocks())

describe('native Google sign-in (Android app)', () => {
  it('signs in to Firebase with the token from the account picker, never a popup', async () => {
    m.nativeSignIn.mockResolvedValue({ credential: { idToken: 'tok' } })
    await signInWithGoogle()
    expect(m.signInWithCredential).toHaveBeenCalledWith(expect.anything(), { providerId: 'google.com', idToken: 'tok' })
    expect(m.signInWithPopup).not.toHaveBeenCalled()
  })

  it('re-authenticates with the account picker before deleting an account', async () => {
    m.nativeSignIn.mockResolvedValue({ credential: { idToken: 'tok2' } })
    await reauthenticate()
    expect(m.reauthenticateWithCredential).toHaveBeenCalledWith(m.user, { providerId: 'google.com', idToken: 'tok2' })
  })

  it('stays quiet when the picker is cancelled, and explains a phone without a Google account', async () => {
    m.nativeSignIn.mockRejectedValue(new Error('activity is cancelled by the user.'))
    const cancelled = await signInWithGoogle().catch((e: unknown) => e)
    expect(authErrorMessage(cancelled)).toBeNull()

    m.nativeSignIn.mockRejectedValue(new Error('No credentials available'))
    const none = await signInWithGoogle().catch((e: unknown) => e)
    expect(authErrorMessage(none)).toMatch(/no Google account/)
    expect(m.signInWithCredential).not.toHaveBeenCalled()
  })

  it('signs out of the native Google session too', async () => {
    await signOutUser()
    expect(m.signOut).toHaveBeenCalled()
    expect(m.nativeSignOut).toHaveBeenCalled()
  })
})
