import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { initDayRollover } from './app/dayRollover'
import { initAccountSync } from './features/profile/accountSync'
import { startAutoQuests } from './features/quests/autoQuests'
import { startPrograms } from './features/programs/programsRepo'
import { startHealthSync } from './features/today/healthSync'
import { registerSW } from 'virtual:pwa-register'
import { isNativeApp } from './lib/platform'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

// Offline support for the website/PWA. The Android app ships its files inside the APK.
if (!isNativeApp()) registerSW({ immediate: true })

initDayRollover()
initAccountSync()
startAutoQuests()
startPrograms()
startHealthSync()

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
