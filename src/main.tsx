import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { initDayRollover } from './app/dayRollover'
import { initAccountSync } from './features/profile/accountSync'
import { startAutoQuests } from './features/quests/autoQuests'
import { startPrograms } from './features/programs/programsRepo'
import { startHealthSync } from './features/today/healthSync'
import { startWebUpdates } from './lib/webUpdates'
import { isNativeApp } from './lib/platform'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

initDayRollover()

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// Background jobs start right after the first screen is up, each in its own task, so they
// don't hold up the first paint on a slow phone. None of them is needed to show a screen.
const background = [
  // Offline support + update checks for the website/PWA. The Android app ships its files
  // inside the APK and registers no service worker (lib/webUpdates.ts).
  startWebUpdates,
  initAccountSync,
  startAutoQuests,
  startPrograms,
  startHealthSync,
]
let started = false
const startBackground = () => {
  if (started) return
  started = true
  for (const job of background) setTimeout(job, 0)
}
requestAnimationFrame(startBackground)
// A tab opened in the background gets no animation frames: start anyway.
setTimeout(startBackground, 1000)

// Android app: drop the splash screen once the first screen is on show.
if (isNativeApp()) {
  requestAnimationFrame(() => {
    void import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {})
  })
}
