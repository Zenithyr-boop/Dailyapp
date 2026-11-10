import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { ChevronLeftIcon, EditIcon, TrashIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { Panel } from '../../../components/Panel'
import { imageUrl, label } from './catalog'
import { Tag } from './Chip'
import { COACH_PICKS } from './coachPicks'
import { deleteCustomMovement } from './customMovements'
import { TRACKING_LABELS, type Movement } from './types'
import { useMovements } from './useMovements'

const FRAME_LABELS = ['Start', 'End']

/** Back to the library, keeping its search and filters when we came from there. */
export function BackToLibrary() {
  const navigate = useNavigate()
  const location = useLocation()
  function back(e: MouseEvent) {
    if (location.key !== 'default') {
      e.preventDefault()
      navigate(-1)
    }
  }
  return (
    <Link
      to="/train/movements"
      onClick={back}
      className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1 px-2 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:text-accent"
    >
      <ChevronLeftIcon size={18} />
      Movements
    </Link>
  )
}

export function MovementDetailPage() {
  const { id = '' } = useParams()
  const { movements, error, retry } = useMovements()
  const movement = movements?.find((m) => m.id === id)

  if (error) {
    return (
      <>
        <BackToLibrary />
        <Panel title="Movement">
          <p className="text-muted">Couldn’t load the movement library. Check your connection and try again.</p>
          <Button variant="secondary" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </Panel>
      </>
    )
  }
  if (!movements) {
    return (
      <>
        <BackToLibrary />
        <p className="text-muted" role="status">
          Loading…
        </p>
      </>
    )
  }
  if (!movement) {
    return (
      <>
        <BackToLibrary />
        <PageHeader title="Not found" />
        <p className="text-muted">This movement doesn’t exist, or it was deleted.</p>
      </>
    )
  }
  return <MovementDetail movement={movement} />
}

function MovementDetail({ movement: m }: { movement: Movement }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isPick = COACH_PICKS.includes(m.id)

  async function remove() {
    await deleteCustomMovement(m.id)
    navigate('/train/movements', { replace: true })
  }

  return (
    <>
      <BackToLibrary />
      <PageHeader title={m.name} />
      <div className="-mt-2 mb-5 flex flex-wrap gap-1.5">
        {m.source === 'custom' && <Tag>Custom</Tag>}
        {isPick && <Tag tone="accent">Coach's pick</Tag>}
        <Tag>{label(m.category)}</Tag>
        {m.level && <Tag>{label(m.level)}</Tag>}
      </div>

      <div className="space-y-4">
        {m.images > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {Array.from({ length: Math.min(m.images, 2) }, (_, i) => (
              <Photo key={i} src={imageUrl(m.id, i)} caption={FRAME_LABELS[i] ?? `Photo ${i + 1}`} name={m.name} />
            ))}
          </div>
        )}

        <Panel title="Muscles">
          <dl className="space-y-3">
            <Fact term="Main">{m.primaryMuscles.map(label).join(', ') || '—'}</Fact>
            {m.secondaryMuscles.length > 0 && <Fact term="Also works">{m.secondaryMuscles.map(label).join(', ')}</Fact>}
          </dl>
        </Panel>

        <Panel title="Setup">
          <dl className="space-y-3">
            <Fact term="Equipment">{label(m.equipment)}</Fact>
            <Fact term="Logged as">{TRACKING_LABELS[m.tracking]}</Fact>
          </dl>
        </Panel>

        {m.instructions.length > 0 && (
          <Panel title="How to do it">
            <ol className="space-y-3">
              {m.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center border border-panel-edge font-display text-sm font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel title="Your history">
          <p className="text-muted">
            Nothing logged yet. Once you log this movement in a workout, your sets and personal records show up here.
          </p>
        </Panel>

        {m.source === 'custom' && (
          <div className="flex gap-2">
            <Link
              to={`/train/movements/${encodeURIComponent(m.id)}/edit`}
              className="inline-flex min-h-touch items-center gap-2 border border-panel-edge px-5 font-display text-base font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
            >
              <EditIcon size={18} />
              Edit
            </Link>
            <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
              <TrashIcon size={18} />
              Delete
            </Button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <Dialog title="Delete movement?" onClose={() => setConfirmDelete(false)}>
          <p className="text-muted">“{m.name}” will be removed from your library on all your devices.</p>
          <div className="flex gap-2">
            <Button onClick={() => void remove()}>Delete</Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3">
      <dt className="label pt-0.5">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A dataset photo, fetched only when the movement is opened (then cached by the service worker). */
function Photo({ src, caption, name }: { src: string; caption: string; name: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading')
  return (
    <figure className="border border-panel-edge bg-panel">
      <div className="relative aspect-[4/3] bg-line">
        {state !== 'failed' && (
          <img
            src={src}
            alt={`${name}: ${caption.toLowerCase()} position`}
            decoding="async"
            crossOrigin="anonymous"
            onLoad={() => setState('ok')}
            onError={() => setState('failed')}
            className={`size-full object-cover ${state === 'ok' ? '' : 'invisible'}`}
          />
        )}
        {state !== 'ok' && (
          <p className="absolute inset-0 grid place-items-center px-3 text-center text-sm text-muted">
            {state === 'loading' ? 'Loading photo…' : 'Photo unavailable offline'}
          </p>
        )}
      </div>
      <figcaption className="label border-t border-line-soft px-3 py-2">{caption}</figcaption>
    </figure>
  )
}
