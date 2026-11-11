import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../../../components/Button'
import { SwapIcon } from '../../../components/icons'
import { PageHeader } from '../../../components/PageHeader'
import type { PhotoPose, ProgressPhoto } from '../../../lib/db'
import { daysBetween, fromDayKey, longDayLabel } from '../../../lib/day'
import { inputClass } from '../../train/workouts/fields'
import { useProfile } from '../../profile/goals/goalsRepo'
import { useBodyDays } from '../bodyRepo'
import { signed } from '../trend'
import { BackLink, PhotoPrivacyNote, Segmented } from '../ui'
import { fmt1, showKg, weightUnit } from '../units'
import { isPose, POSES, poseLabel, usePhotoImage, usePhotos } from './photosRepo'
import { StoredImage } from './StoredImage'

type PoseFilter = PhotoPose | 'any'
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** The photo to show for a day: the newest with the chosen pose (any pose when none match). */
function pick(photos: ProgressPhoto[], date: string | undefined, pose: PoseFilter): ProgressPhoto | undefined {
  const onDay = photos.filter((p) => p.date === date)
  return (pose === 'any' ? undefined : onDay.find((p) => p.pose === pose)) ?? onDay[0]
}

/**
 * Side-by-side compare of any two dates (`?a=&b=` day keys, `?pose=`).
 * Defaults to the first and the latest day with photos.
 */
export function ComparePage() {
  const photos = usePhotos()
  const days = useBodyDays()
  const profile = useProfile()
  const [params, setParams] = useSearchParams()
  const poseParam = params.get('pose')
  const pose: PoseFilter = isPose(poseParam) ? poseParam : 'any'

  const dates = useMemo(() => [...new Set((photos ?? []).map((p) => p.date))], [photos]) // newest first
  const valid = (d: string | null) => (d && dates.includes(d) ? d : undefined)
  const b = valid(params.get('b')) ?? dates[0]
  const a = valid(params.get('a')) ?? dates.find((d) => d !== b && d < (b ?? '')) ?? dates.at(-1)

  function set(changes: Record<string, string | undefined>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true, preventScrollReset: true })
  }

  const poses: readonly { id: PoseFilter; label: string }[] = [
    { id: 'any', label: 'Any' },
    ...POSES.filter((o) => photos?.some((p) => p.pose === o.id)),
  ]

  if (!photos || !days || !profile) {
    return (
      <p className="text-muted" role="status">
        Loading…
      </p>
    )
  }

  const units = profile.units
  const weightOn = (d: string | undefined) => days.find((x) => x.date === d)?.weightKg
  const [left, right] = a && b && a > b ? [b, a] : [a, b]
  const wl = weightOn(left)
  const wr = weightOn(right)

  return (
    <>
      <BackLink to="/body/photos">Photos</BackLink>
      <PageHeader title="Compare" />
      {dates.length < 2 ? (
        <div className="space-y-4">
          <p className="border border-line p-6 text-center text-muted">Add photos on at least two different days to compare them.</p>
          <PhotoPrivacyNote compact />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {poses.length > 1 && (
              <div>
                <p className="label mb-1">Pose</p>
                <Segmented label="Pose" options={poses} value={pose} onChange={(v) => set({ pose: v === 'any' ? undefined : v })} />
              </div>
            )}
            <Button variant="secondary" onClick={() => set({ a: b, b: a })} aria-label="Swap the two days">
              <SwapIcon size={18} />
              Swap
            </Button>
          </div>

          {left && right && (
            <p className="font-display text-lg font-bold uppercase tracking-wider">
              {Math.abs(daysBetween(left, right))} days apart
              {wl !== undefined && wr !== undefined && (
                <span className="ml-3 text-muted">
                  {signed(showKg(wr, units) - showKg(wl, units))} {weightUnit(units)}
                </span>
              )}
            </p>
          )}

          <div className="grid max-w-3xl grid-cols-2 gap-2 sm:gap-4">
            <Side
              label="First day"
              value={a}
              dates={dates}
              photo={pick(photos, a, pose)}
              weight={weightOn(a)}
              units={units}
              onChange={(d) => set({ a: d })}
            />
            <Side
              label="Second day"
              value={b}
              dates={dates}
              photo={pick(photos, b, pose)}
              weight={weightOn(b)}
              units={units}
              onChange={(d) => set({ b: d })}
            />
          </div>
          <PhotoPrivacyNote compact />
        </div>
      )}
    </>
  )
}

function Side({
  label,
  value,
  dates,
  photo,
  weight,
  units,
  onChange,
}: {
  label: string
  value: string | undefined
  dates: string[]
  photo: ProgressPhoto | undefined
  weight: number | undefined
  units: 'metric' | 'imperial'
  onChange: (d: string) => void
}) {
  const id = useId()
  const image = usePhotoImage(photo?.id)
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label block">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`}>
        {dates.map((d) => (
          <option key={d} value={d}>
            {shortDate.format(fromDayKey(d))}
          </option>
        ))}
      </select>
      <div className="mt-2 grid aspect-[3/4] place-items-center overflow-hidden border border-line bg-bg">
        {photo ? (
          <StoredImage
            bytes={image ?? photo.thumb}
            type={photo.type}
            alt={`${poseLabel(photo.pose) ?? 'Photo'}, ${value ? longDayLabel(value) : ''}`}
            className="size-full object-contain"
          />
        ) : (
          <span className="p-2 text-center text-sm text-muted">No photo</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {photo?.pose ? `${poseLabel(photo.pose)} · ` : ''}
        {weight !== undefined ? `${fmt1(showKg(weight, units))} ${weightUnit(units)}` : 'No weigh-in that day'}
      </p>
    </div>
  )
}
