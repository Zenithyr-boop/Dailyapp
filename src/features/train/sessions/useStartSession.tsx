import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import type { Session, WorkoutTemplate } from '../../../lib/db'
import { loadLibrary } from '../library/catalog'
import { customToMovement, listCustomMovements } from '../library/customMovements'
import { deleteSession, getActiveSession, startSession, type TrackingOf } from './sessionsRepo'
import { skipRest } from './restTimer'

/** How each movement is logged (library + custom), for building a session. */
export async function loadTrackingLookup(): Promise<TrackingOf> {
  const [library, custom] = await Promise.all([loadLibrary(), listCustomMovements()])
  const map = new Map([...library, ...custom.map(customToMovement)].map((m) => [m.id, m.tracking]))
  return (id) => map.get(id) ?? 'weight_reps'
}

/**
 * Start a session from a workout (or empty) and open the logger. If one is
 * already in progress, asks: resume it, or discard it and start the new one.
 * Render `dialog` somewhere in the calling screen.
 */
export function useStartSession() {
  const navigate = useNavigate()
  const [conflict, setConflict] = useState<{ active: Session; template?: WorkoutTemplate; date?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function begin(template?: WorkoutTemplate, date?: string) {
    await startSession(template, await loadTrackingLookup(), Date.now(), date)
    await skipRest()
    navigate('/train/session')
  }

  /** `date` logs the workout for an earlier day (default today). */
  async function start(template?: WorkoutTemplate, date?: string) {
    if (busy) return
    setBusy(true)
    try {
      const active = await getActiveSession()
      if (active) setConflict({ active, template, date })
      else await begin(template, date)
    } finally {
      setBusy(false)
    }
  }

  const dialog = conflict && (
    <Dialog title="Session in progress" onClose={() => setConflict(null)}>
      <p>
        <strong>{conflict.active.name}</strong> is still open. Finish it first, or discard it and start{' '}
        {conflict.template ? <strong>{conflict.template.name || 'this workout'}</strong> : 'an empty session'}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/train/session')}>Resume it</Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await deleteSession(conflict.active.id)
            const { template, date } = conflict
            setConflict(null)
            await begin(template, date)
          }}
        >
          Discard and start
        </Button>
        <Button variant="secondary" onClick={() => setConflict(null)}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )

  return { start, busy, dialog }
}
