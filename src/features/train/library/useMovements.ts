import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { loadLibrary } from './catalog'
import { customToMovement, listCustomMovements } from './customMovements'
import type { Movement } from './types'

export interface MovementsState {
  /** Library + custom movements; undefined while loading. */
  movements: Movement[] | undefined
  error: boolean
  retry: () => void
}

/** The bundled library plus the user's custom movements (live). */
export function useMovements(): MovementsState {
  const [library, setLibrary] = useState<Movement[]>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const custom = useLiveQuery(listCustomMovements, [])

  useEffect(() => {
    let active = true
    loadLibrary().then(
      (list) => active && setLibrary(list),
      () => active && setError(true),
    )
    return () => {
      active = false
    }
  }, [attempt])

  const movements = useMemo(
    () => (library && custom ? [...custom.map(customToMovement), ...library] : undefined),
    [library, custom],
  )

  return {
    movements,
    error,
    retry: () => {
      setError(false)
      setAttempt((n) => n + 1)
    },
  }
}
