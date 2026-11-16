/// <reference types="vite/client" />

/** This build's version (package.json), short git commit and build time, injected by vite.config.ts. */
declare const __BUILD_INFO__: { version: string; commit: string; builtAt: string }

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string
  /** Set only by `npm run dev:emulator`: use the local Auth emulator instead of the real project. */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string
  /** Open Food Facts server: "staging" (default in dev) or "production" (default in builds). */
  readonly VITE_OFF_SERVER?: "staging" | "production"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
