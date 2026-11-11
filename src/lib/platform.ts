import { Capacitor } from '@capacitor/core'

/*
 * Which build is running: the website/PWA, or the Android app (the same code wrapped
 * by Capacitor). Native-only features (Health Connect, native Google sign-in, the
 * update check, keep-awake) check this and do nothing on the web.
 */

/** True inside the Android APK. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** True inside the Android APK only (not a future iOS build). */
export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android'
}
