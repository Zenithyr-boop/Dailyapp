import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { initDayRollover } from './app/dayRollover'
import { initAccountSync } from './features/profile/accountSync'
import { startAutoQuests } from './features/quests/autoQuests'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

initDayRollover()
initAccountSync()
startAutoQuests()

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
