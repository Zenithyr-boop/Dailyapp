import type { CapacitorConfig } from '@capacitor/cli'

/*
 * The Android app: the same web build (dist/) wrapped by Capacitor.
 * `npm run android:sync` builds the website and copies it into android/.
 */
const config: CapacitorConfig = {
  appId: 'app.fromzero',
  appName: 'FromZero',
  webDir: 'dist',
  backgroundColor: '#0B0E14',
  android: {
    // Never load http:// content inside the app.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app once the first screen has rendered (main.tsx), with a fallback.
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0B0E14',
      showSpinner: false,
    },
    SystemBars: {
      // Dark bars to match the Midnight background; the page pads itself with env(safe-area-inset-*).
      style: 'DARK',
      insetsHandling: 'css',
    },
    FirebaseAuthentication: {
      // The native plugin only gets the Google token; the Firebase web SDK does the real
      // sign-in (lib/auth.ts), so sync and Firestore keep using one Auth instance.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
}

export default config
