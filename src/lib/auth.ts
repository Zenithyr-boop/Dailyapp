import { getFirebaseAuth, isFirebaseConfigured } from './firebase'
import { isNativeApp } from './platform'

/*
 * Thin wrapper around Firebase Auth so UI code (and tests) never touch the SDK directly.
 * The SDK is imported on demand, so it stays out of the startup bundle.
 * Google sign-in: a popup on the website. In the Android app popups don't work, so the
 * native `@capacitor-firebase/authentication` plugin shows Android's Google account picker
 * and hands back an ID token, which signs in to the same Firebase web SDK (skipNativeAuth),
 * so sync and Firestore keep one Auth instance everywhere.
 */

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  /** 'google.com' or 'password'. */
  provider: string
}

export const authAvailable = isFirebaseConfigured

const sdk = () => import('firebase/auth')

/** Calls back with the signed-in user (or null) now and on every change. Returns an unsubscribe. */
export function watchAuth(callback: (user: AuthUser | null) => void): () => void {
  let unsubscribe: (() => void) | undefined
  let stopped = false

  void Promise.all([getFirebaseAuth(), sdk()])
    .then(([auth, { onAuthStateChanged }]) => {
      if (stopped) return
      unsubscribe = onAuthStateChanged(auth, (user) => {
        callback(
          user
            ? {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                provider: user.providerData[0]?.providerId ?? 'password',
              }
            : null,
        )
      })
    })
    .catch((error: unknown) => {
      // Firebase failed to load (e.g. offline on first visit): treat as signed out.
      console.warn('Firebase Auth unavailable', error)
      if (!stopped) callback(null)
    })

  return () => {
    stopped = true
    unsubscribe?.()
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const [auth, { signInWithEmailAndPassword }] = await Promise.all([getFirebaseAuth(), sdk()])
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function createAccount(email: string, password: string): Promise<void> {
  const [auth, { createUserWithEmailAndPassword }] = await Promise.all([getFirebaseAuth(), sdk()])
  await createUserWithEmailAndPassword(auth, email.trim(), password)
}

/**
 * Android app: Google's account picker (native plugin), turned into a Firebase credential.
 * Cancelling looks like closing the popup (no message); errors get Firebase-style codes.
 */
async function nativeGoogleCredential() {
  const [{ FirebaseAuthentication }, { GoogleAuthProvider }] = await Promise.all([
    import('@capacitor-firebase/authentication'),
    sdk(),
  ])
  let idToken: string | undefined
  try {
    idToken = (await FirebaseAuthentication.signInWithGoogle()).credential?.idToken
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = /cancel/i.test(message)
      ? 'auth/popup-closed-by-user'
      : /no credential/i.test(message)
        ? 'auth/no-google-account'
        : 'auth/native-google-failed'
    throw Object.assign(new Error(message), { code })
  }
  if (!idToken) throw Object.assign(new Error('No Google ID token'), { code: 'auth/native-google-failed' })
  return GoogleAuthProvider.credential(idToken)
}

export async function signInWithGoogle(): Promise<void> {
  if (isNativeApp()) {
    const [auth, credential, { signInWithCredential }] = await Promise.all([getFirebaseAuth(), nativeGoogleCredential(), sdk()])
    await signInWithCredential(auth, credential)
    return
  }
  const [auth, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([getFirebaseAuth(), sdk()])
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth, provider)
}

export async function sendPasswordReset(email: string): Promise<void> {
  const [auth, { sendPasswordResetEmail }] = await Promise.all([getFirebaseAuth(), sdk()])
  await sendPasswordResetEmail(auth, email.trim())
}

export async function signOutUser(): Promise<void> {
  const [auth, { signOut }] = await Promise.all([getFirebaseAuth(), sdk()])
  await signOut(auth)
  if (isNativeApp()) {
    // Forget the Google account on the phone too, so the picker shows next time.
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
    await FirebaseAuthentication.signOut().catch(() => {})
  }
}

/**
 * Confirm it's really the user before deleting the account (Firebase requires a
 * recent sign-in). Google accounts pick their account again (a popup on the website,
 * the account picker in the Android app); email accounts enter their password.
 */
export async function reauthenticate(password?: string): Promise<void> {
  const [auth, { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup }] =
    await Promise.all([getFirebaseAuth(), sdk()])
  const user = auth.currentUser
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' })
  if (password === undefined) {
    if (isNativeApp()) await reauthenticateWithCredential(user, await nativeGoogleCredential())
    else await reauthenticateWithPopup(user, new GoogleAuthProvider())
  } else {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password))
  }
}

/** Delete the signed-in user's sign-in account. Call `reauthenticate` first. */
export async function deleteCurrentUser(): Promise<void> {
  const [auth, { deleteUser }] = await Promise.all([getFirebaseAuth(), sdk()])
  if (auth.currentUser) await deleteUser(auth.currentUser)
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'Email or password is wrong.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-email': 'Enter your email address first.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/popup-blocked': 'The Google window was blocked. Allow pop-ups for this site and try again.',
  'auth/operation-not-allowed': 'This sign-in method isn’t switched on yet.',
  'auth/unauthorized-domain': 'Sign-in isn’t allowed on this web address yet.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-mismatch': 'That’s a different account. Pick the one you’re signed in with.',
  'auth/requires-recent-login': 'Please confirm it’s you again, then try once more.',
  'auth/no-current-user': 'You’re signed out. Sign in again first.',
  'auth/no-google-account': 'There’s no Google account on this phone. Add one in Android settings, or use email.',
  'auth/native-google-failed': 'Google sign-in didn’t work. Try again, or use email.',
}

/** Codes that mean the user backed out; show nothing. */
const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

/** Turn a Firebase Auth error into a short message for the UI, or null to show nothing. */
export function authErrorMessage(error: unknown): string | null {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (SILENT.has(code)) return null
  return MESSAGES[code] ?? 'Something went wrong. Try again.'
}
