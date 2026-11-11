/**
 * Shrinks a picked photo before it's stored on the device: a JPEG with the
 * longest side at most `PHOTO_MAX_SIDE`, plus a small thumbnail for grids.
 * Browsers apply the camera's EXIF rotation when decoding an <img>, so the
 * stored pixels are upright.
 */
export const PHOTO_MAX_SIDE = 1600
export const THUMB_MAX_SIDE = 480
const PHOTO_QUALITY = 0.85
const THUMB_QUALITY = 0.75

export interface PreparedImage {
  image: ArrayBuffer
  thumb: ArrayBuffer
  type: string
  width: number
  height: number
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function encode(img: HTMLImageElement, maxSide: number, quality: number): Promise<{ buf: ArrayBuffer; w: number; h: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not encode the photo')
  return { buf: await blob.arrayBuffer(), w, h }
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const img = await loadImage(file)
  const full = await encode(img, PHOTO_MAX_SIDE, PHOTO_QUALITY)
  const thumb = await encode(img, THUMB_MAX_SIDE, THUMB_QUALITY)
  return { image: full.buf, thumb: thumb.buf, type: 'image/jpeg', width: full.w, height: full.h }
}
