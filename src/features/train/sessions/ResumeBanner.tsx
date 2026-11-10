import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { PlayIcon } from '../../../components/icons'
import { formatClock } from './records'
import { useNow } from './restTimer'
import { getActiveSession } from './sessionsRepo'

/** "Resume session" banner, shown while a session is unfinished. */
export function ResumeBanner() {
  const session = useLiveQuery(getActiveSession, [])
  const now = useNow(1000, !!session)
  if (!session) return null
  const done = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  return (
    <Link
      to="/train/session"
      className="group flex min-h-touch items-center gap-3 border border-accent bg-panel px-4 py-3 hover:bg-accent hover:text-on-accent"
    >
      <span className="grid size-10 shrink-0 place-items-center bg-accent text-on-accent group-hover:bg-on-accent group-hover:text-accent">
        <PlayIcon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold uppercase leading-tight tracking-wider">Resume session</span>
        <span className="block truncate text-sm text-muted group-hover:text-on-accent">
          {session.name} · {formatClock(now - session.startedAt)} · {done} set{done === 1 ? '' : 's'} done
        </span>
      </span>
    </Link>
  )
}
