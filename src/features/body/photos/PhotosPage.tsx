import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { PlusIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import { useOverlay } from '../../../components/useOverlay'
import type { PhotoPose, ProgressPhoto } from '../../../lib/db'
import { clampDay, dayLabel, longDayLabel, useToday } from '../../../lib/day'
import { inputClass } from '../../train/workouts/fields'
import { BackLink, PhotoPrivacyNote, Segmented } from '../ui'
import { prepareImage } from './image'
import { addPhoto, deletePhoto, POSES, poseLabel, updatePhoto, usePhotoImage, usePhotos } from './photosRepo'
import { StoredImage } from './StoredImage'

type PoseChoice = PhotoPose | 'none'
const POSE_CHOICES: readonly { id: PoseChoice; label: string }[] = [{ id: 'none', label: 'None' }, ...POSES]

const photoName = (p: Pick<ProgressPhoto, 'pose' | 'date'>, today: string) =>
  `${poseLabel(p.pose) ? `${poseLabel(p.pose)} photo` : 'Photo'}, ${dayLabel(p.date, today)}`

/** Progress photos: device-only, grouped by day, with a side-by-side compare. */
export function PhotosPage() {
  const today = useToday()
  const photos = usePhotos()
  const overlay = useOverlay()
  const openId = overlay.params.get('photo')
  const [picked, setPicked] = useState<File>()
  const inputId = useId()

  const byDate = useMemo(() => {
    const groups = new Map<string, ProgressPhoto[]>()
    for (const p of photos ?? []) groups.set(p.date, [...(groups.get(p.date) ?? []), p])
    return [...groups]
  }, [photos])
  const open = photos?.find((p) => p.id === openId)

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires
    if (file) setPicked(file)
  }

  return (
    <>
      <BackLink to="/body">Body</BackLink>
      <PageHeader
        title="Progress photos"
        aside={
          byDate.length >= 2 ? (
            <Link
              to="/body/photos/compare"
              className="inline-flex min-h-touch items-center border border-panel-edge px-4 font-display font-bold uppercase tracking-wider hover:border-accent hover:text-accent"
            >
              Compare
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-4">
        <PhotoPrivacyNote />

        <div>
          <input id={inputId} type="file" accept="image/*" onChange={onPick} className="peer sr-only" />
          <label
            htmlFor={inputId}
            className="inline-flex min-h-touch w-full cursor-pointer items-center justify-center gap-2 bg-accent px-5 font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent sm:w-auto"
          >
            <PlusIcon size={18} />
            Add a photo
          </label>
          <p className="mt-2 text-sm text-muted">Same light, same spot, same pose each time makes the compare honest.</p>
        </div>

        {!photos ? (
          <p className="text-muted" role="status">
            Loading photos…
          </p>
        ) : photos.length === 0 ? (
          <p className="border border-line p-6 text-center text-muted">No photos yet.</p>
        ) : (
          byDate.map(([date, list]) => (
            <section key={date} aria-label={longDayLabel(date)} className="border border-panel-edge bg-panel">
              <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft px-4">
                <h2 className="label">{dayLabel(date, today)}</h2>
                <span className="font-display text-sm font-semibold text-muted">{list.length === 1 ? '1 photo' : `${list.length} photos`}</span>
              </header>
              <ul className="grid grid-cols-3 gap-1 p-1 sm:grid-cols-4 lg:grid-cols-6">
                {list.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => overlay.open('photo', p.id)}
                      className="group relative block aspect-[3/4] w-full overflow-hidden bg-bg"
                      aria-label={`${photoName(p, today)}. Open`}
                    >
                      <StoredImage bytes={p.thumb} type={p.type} alt="" className="size-full object-cover group-hover:opacity-80" />
                      {p.pose && (
                        <span className="absolute bottom-0 left-0 bg-bg px-1.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider">
                          {poseLabel(p.pose)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {picked && <AddPhotoDialog file={picked} today={today} onClose={() => setPicked(undefined)} />}
      {open && <PhotoDialog photo={open} today={today} onClose={() => overlay.close('photo')} />}
    </>
  )
}

function DateField({ id, value, today, onChange }: { id: string; value: string; today: string; onChange: (d: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label block">
        Day
      </label>
      <input
        id={id}
        type="date"
        value={value}
        max={today}
        required
        onChange={(e) => e.target.value && onChange(clampDay(e.target.value, today))}
        className={`${inputClass} mt-1`}
      />
    </div>
  )
}

function AddPhotoDialog({ file, today, onClose }: { file: File; today: string; onClose: () => void }) {
  const id = useId()
  const [date, setDate] = useState(today)
  const [pose, setPose] = useState<PoseChoice>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    try {
      const prepared = await prepareImage(file)
      await addPhoto(prepared, date, pose === 'none' ? undefined : pose)
      onClose()
    } catch {
      setError('That image couldn’t be read. Try another photo, or a JPEG or PNG.')
      setBusy(false)
    }
  }

  return (
    <Dialog title="Add a photo" onClose={onClose} busy={busy}>
      <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-bg">
        <StoredImage bytes={file} type={file.type} alt="The photo you picked" className="max-h-full max-w-full object-contain" />
      </div>
      <DateField id={`${id}-date`} value={date} today={today} onChange={setDate} />
      <div>
        <p className="label mb-1">Pose (optional)</p>
        <Segmented label="Pose" options={POSE_CHOICES} value={pose} onChange={setPose} />
      </div>
      <p className="text-sm text-muted">Saved on this device only. Never uploaded.</p>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save photo'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}

function PhotoDialog({ photo, today, onClose }: { photo: ProgressPhoto; today: string; onClose: () => void }) {
  const id = useId()
  const image = usePhotoImage(photo.id)
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [date, setDate] = useState(photo.date)
  const [pose, setPose] = useState<PoseChoice>(photo.pose ?? 'none')

  async function saveEdit() {
    await updatePhoto(photo.id, { date, pose: pose === 'none' ? undefined : pose })
    setMode('view')
  }

  async function remove() {
    await deletePhoto(photo.id)
    onClose()
  }

  return (
    <Dialog title={photoName(photo, today)} onClose={onClose}>
      <div className="grid place-items-center bg-bg" style={{ aspectRatio: `${photo.width} / ${photo.height}`, maxHeight: '60vh' }}>
        <StoredImage
          bytes={image ?? photo.thumb}
          type={photo.type}
          alt={photoName(photo, today)}
          className="max-h-[60vh] max-w-full object-contain"
        />
      </div>

      {mode === 'view' && (
        <>
          <p className="text-sm text-muted">{longDayLabel(photo.date)}. Stored on this device only.</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/body/photos/compare?${new URLSearchParams({ b: photo.date, ...(photo.pose ? { pose: photo.pose } : {}) })}`}
              className="inline-flex min-h-touch items-center justify-center bg-accent px-4 font-display font-bold uppercase tracking-wider text-on-accent hover:bg-text"
            >
              Compare
            </Link>
            <Button variant="secondary" onClick={() => setMode('edit')}>
              Edit
            </Button>
            <Button variant="secondary" onClick={() => setMode('delete')}>
              Delete
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}

      {mode === 'edit' && (
        <>
          <DateField id={`${id}-date`} value={date} today={today} onChange={setDate} />
          <div>
            <p className="label mb-1">Pose</p>
            <Segmented label="Pose" options={POSE_CHOICES} value={pose} onChange={setPose} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void saveEdit()}>
              Save
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setMode('view')}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {mode === 'delete' && (
        <>
          <p role="alert">
            Delete this photo? It exists only on this device, so it can’t be recovered.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void remove()}>
              Delete for good
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setMode('view')}>
              Keep it
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
