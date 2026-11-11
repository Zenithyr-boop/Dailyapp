import type { FirebaseApp, FirebaseOptions } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { isNativeApp } from './platform'

/*
 * Firebase setup. The web config comes from the committed `.env` (VITE_FIREBASE_*).
 * It is public by design; Firestore security rules (`firestore.rules`) protect the data.
 *
 * The app is local-first: the Firebase SDK is loaded on demand (its own JS chunks) the
 * first time something asks for Auth or Firestore, so startup stays fast and every screen
 * works while signed out or offline.
 */

const env = import.meta.env

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
}

/** False when the build has no Firebase config (e.g. a fork without `.env`). Sign-in is hidden then. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

let appPromise: Promise<FirebaseApp> | undefined
let authPromise: Promise<Auth> | undefined
let firestorePromise: Promise<Firestore> | undefined

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error('Firebase is not configured: VITE_FIREBASE_* variables are missing.'))
  }
  appPromise ??= import('firebase/app').then(({ initializeApp }) => initializeApp(firebaseConfig))
  return appPromise
}

export function getFirebaseAuth(): Promise<Auth> {
  authPromise ??= Promise.all([getFirebaseApp(), import('firebase/auth')]).then(
    ([app, { getAuth, initializeAuth, indexedDBLocalPersistence, connectAuthEmulator }]) => {
      // Android app: no popup/redirect support (it loads Google's iframe helpers, which a
      // Capacitor WebView can't use); sign-in comes from the native plugin (lib/auth.ts).
      const auth = isNativeApp() ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app)
      // Local testing only: `npm run dev:emulator` sets this (see `.env.emulator`).
      const emulatorUrl = env.VITE_FIREBASE_AUTH_EMULATOR_URL
      if (emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true })
      return auth
    },
  )
  return authPromise
}

/**
 * Cloud Firestore, used only by account sync (`lib/sync`). Memory cache only:
 * Dexie is the offline store, so Firestore doesn't keep a second copy on disk.
 */
export function getFirestoreDb(): Promise<Firestore> {
  firestorePromise ??= Promise.all([getFirebaseApp(), import('firebase/firestore')]).then(
    ([app, { initializeFirestore, memoryLocalCache }]) =>
      initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true }),
  )
  return firestorePromise
}
