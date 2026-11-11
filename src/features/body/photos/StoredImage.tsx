import { useEffect, useRef, type ImgHTMLAttributes } from 'react'

/**
 * An <img> showing stored image bytes (or a picked file) through an object URL, revoked when
 * the bytes change or it unmounts.
 */
export function StoredImage({
  bytes,
  type = 'image/jpeg',
  alt,
  ...rest
}: { bytes: ArrayBuffer | Blob | null | undefined; type?: string; alt: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !bytes) return
    const url = URL.createObjectURL(new Blob([bytes], { type }))
    el.src = url
    return () => {
      el.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [bytes, type])
  return <img ref={ref} alt={alt} {...rest} />
}
