/**
 * Camera barcode scanning. Uses the browser's BarcodeDetector where it exists
 * (Chrome on Android, the Android WebView, desktop Chrome on some systems);
 * elsewhere (iPhone Safari, Firefox) a JS decoder from @zxing, loaded only
 * when needed. Typing the number by hand always works as well (ScannerDialog).
 */
import { cleanBarcode } from '../off'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
const INTERVAL_MS = 200

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorClass {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

type Decode = (video: HTMLVideoElement) => Promise<string | undefined>

async function nativeDecoder(): Promise<Decode | undefined> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector
  if (!Detector) return undefined
  try {
    const supported = (await Detector.getSupportedFormats?.()) ?? []
    const formats = FORMATS.filter((f) => supported.includes(f))
    if (!formats.length) return undefined
    const detector = new Detector({ formats })
    return async (video) => (await detector.detect(video))[0]?.rawValue
  } catch {
    return undefined
  }
}

async function zxingDecoder(): Promise<Decode> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map<(typeof DecodeHintType)[keyof typeof DecodeHintType], unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  ])
  const reader = new BrowserMultiFormatReader(hints)
  const canvas = document.createElement('canvas')
  return async (video) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return undefined
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(video, 0, 0, w, h)
    try {
      return reader.decodeFromCanvas(canvas).getText()
    } catch {
      return undefined // nothing found in this frame
    }
  }
}

/** UPC-E (8 digits, starting 0/1) → UPC-A, the form databases store. */
export function expandUpcE(code: string): string {
  if (!/^[01]\d{7}$/.test(code)) return code
  const [s, a, b, c, d, e, last, check] = code.split('') as string[]
  let body: string
  if (last === '0' || last === '1' || last === '2') body = `${a}${b}${last}0000${c}${d}${e}`
  else if (last === '3') body = `${a}${b}${c}00000${d}${e}`
  else if (last === '4') body = `${a}${b}${c}${d}00000${e}`
  else body = `${a}${b}${c}${d}${e}0000${last}`
  return `${s}${body}${check}`
}

export type ScanProblem = 'unsupported' | 'denied' | 'no-camera' | 'failed'

export class ScanError extends Error {
  readonly problem: ScanProblem
  constructor(problem: ScanProblem) {
    super(problem)
    this.problem = problem
  }
}

export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Start the camera in `video` and call `onCode` once with the first valid
 * barcode. Returns a stop function (also call it on unmount).
 */
export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  if (!cameraAvailable()) throw new ScanError('unsupported')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  } catch (error) {
    const name = (error as DOMException)?.name
    throw new ScanError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-camera' : 'failed')
  }

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    stopped = true
    clearTimeout(timer)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }

  try {
    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', '')
    await video.play()
    const decode = (await nativeDecoder()) ?? (await zxingDecoder())
    const tick = async () => {
      if (stopped) return
      try {
        const raw = await decode(video)
        const code = raw ? cleanBarcode(expandUpcE(raw)) : undefined
        if (code && !stopped) {
          stop()
          onCode(code)
          return
        }
      } catch {
        // A frame that can't be read: try the next one.
      }
      timer = setTimeout(() => void tick(), INTERVAL_MS)
    }
    void tick()
  } catch {
    stop()
    throw new ScanError('failed')
  }
  return stop
}
