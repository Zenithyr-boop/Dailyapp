import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { inputClass } from '../../train/workouts/fields'
import { foodForBarcode } from '../foodsRepo'
import type { Food } from '../nutrition'
import { cleanBarcode, offErrorText } from '../off'
import { cameraAvailable, ScanError, startScanner, type ScanProblem } from '../scan/scanner'

const PROBLEMS: Record<ScanProblem, string> = {
  unsupported: 'This browser can’t use the camera. Type the number under the barcode instead.',
  denied: 'Camera access was blocked. Allow it in your browser’s site settings, or type the number instead.',
  'no-camera': 'No camera found. Type the number under the barcode instead.',
  failed: 'The camera didn’t start. Type the number under the barcode instead.',
}

type Phase =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'notFound'; code: string }
  | { kind: 'error'; code: string; message: string }

interface ScannerDialogProps {
  onFound: (food: Food) => void
  onClose: () => void
}

/** Scan with the camera, or type the barcode. Looks the code up (your foods, then Open Food Facts). */
export function ScannerDialog({ onFound, onClose }: ScannerDialogProps) {
  const id = useId()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | ScanProblem>(cameraAvailable() ? 'starting' : 'unsupported')
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' })
  const [typed, setTyped] = useState('')
  const [attempt, setAttempt] = useState(0)
  const onFoundRef = useRef(onFound)
  useEffect(() => {
    onFoundRef.current = onFound
  })

  const stopRef = useRef<(() => void) | undefined>(undefined)

  async function lookUp(code: string) {
    // Typed codes: the camera isn't needed any more.
    stopRef.current?.()
    setPhase({ kind: 'looking', code })
    try {
      const food = await foodForBarcode(code)
      if (food) onFoundRef.current(food)
      else setPhase({ kind: 'notFound', code })
    } catch (error) {
      setPhase({ kind: 'error', code, message: offErrorText(error) })
    }
  }
  const lookUpRef = useRef(lookUp)
  useEffect(() => {
    lookUpRef.current = lookUp
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !cameraAvailable()) return
    let cancelled = false
    startScanner(video, (code) => void lookUpRef.current(code))
      .then((s) => {
        if (cancelled) s()
        else {
          stopRef.current = s
          setCamera('on')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setCamera(error instanceof ScanError ? error.problem : 'failed')
      })
    return () => {
      cancelled = true
      stopRef.current?.()
      stopRef.current = undefined
    }
  }, [attempt])

  function submitTyped(e: FormEvent) {
    e.preventDefault()
    const code = cleanBarcode(typed)
    if (code) void lookUp(code)
  }

  function scanAgain() {
    setPhase({ kind: 'scanning' })
    setCamera(cameraAvailable() ? 'starting' : 'unsupported')
    setAttempt((n) => n + 1)
  }

  const typedValid = !!cleanBarcode(typed)
  const showVideo = camera === 'starting' || camera === 'on'

  return (
    <Dialog title="Scan a barcode" onClose={onClose}>
      {showVideo ? (
        <div className={`relative aspect-[4/3] w-full overflow-hidden border border-line bg-bg ${phase.kind === 'scanning' ? '' : 'hidden'}`}>
          <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Camera view" />
          {/* Aiming guide: a flat box, no glow. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 border-2 border-accent" />
          <p role="status" className="absolute inset-x-0 bottom-0 bg-bg/85 px-3 py-2 text-center text-sm">
            {camera === 'starting' ? 'Starting the camera…' : 'Hold the barcode inside the box.'}
          </p>
        </div>
      ) : null}
      {!showVideo && phase.kind === 'scanning' ? <p className="text-muted">{PROBLEMS[camera as ScanProblem]}</p> : null}

      {phase.kind === 'looking' && (
        <p role="status" className="tabular-nums">
          Looking up {phase.code}…
        </p>
      )}
      {phase.kind === 'notFound' && (
        <div role="status" className="space-y-3">
          <p>
            <span className="tabular-nums">{phase.code}</span> isn’t in Open Food Facts yet.
          </p>
          <Link
            to={`/food/foods/new?barcode=${phase.code}`}
            className="inline-flex min-h-touch w-full items-center justify-center bg-accent px-5 font-display text-base font-bold uppercase tracking-wider text-on-accent hover:bg-text"
          >
            Create it as your food
          </Link>
          <Button variant="secondary" className="w-full" onClick={scanAgain}>
            Scan again
          </Button>
        </div>
      )}
      {phase.kind === 'error' && (
        <div role="alert" className="space-y-3">
          <p>{phase.message}</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void lookUp(phase.code)}>
              Try again
            </Button>
            <Button variant="secondary" onClick={scanAgain}>
              Scan again
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={submitTyped} className="border-t border-line-soft pt-4">
        <label htmlFor={`${id}-code`} className="label">
          Or type the number
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={`${id}-code`}
            className={inputClass}
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 3017620422003"
            value={typed}
            maxLength={20}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button type="submit" disabled={!typedValid || phase.kind === 'looking'}>
            Look up
          </Button>
        </div>
        {typed.trim() && !typedValid && <p className="mt-1 text-sm text-muted">A barcode is 8 to 14 digits.</p>}
      </form>

      <Button variant="secondary" className="w-full" onClick={onClose}>
        Close
      </Button>
    </Dialog>
  )
}
