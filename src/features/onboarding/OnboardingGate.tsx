import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useProfile } from '../profile/goals/goalsRepo'
import { ensureSetup } from '../quests/questsRepo'

/**
 * Sends a brand-new user to the first-run flow (`/welcome`) before the app.
 * Profiles that finished or skipped it (or existed before onboarding did, see
 * db v6) go straight through.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const profile = useProfile()

  useEffect(() => {
    void ensureSetup()
  }, [])

  // Loading from IndexedDB, or the first-launch profile is being created.
  if (!profile) return null
  if (!profile.onboarding) return <Navigate to="/welcome" replace />
  return children
}
