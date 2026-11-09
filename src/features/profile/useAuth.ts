import { useEffect, useState } from 'react'
import { authAvailable, watchAuth, type AuthUser } from '../../lib/auth'

export type AuthState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser }

/** Current Firebase sign-in state. 'unavailable' when the build has no Firebase config. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    authAvailable ? { status: 'loading' } : { status: 'unavailable' },
  )

  useEffect(() => {
    if (!authAvailable) return
    return watchAuth((user) => setState(user ? { status: 'signed-in', user } : { status: 'signed-out' }))
  }, [])

  return state
}
