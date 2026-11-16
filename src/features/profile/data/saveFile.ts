/**
 * Hand an export to the user.
 * Website / PWA: a normal browser download.
 * Android app: the WebView can't download a blob, so the file is written to the app's
 * cache and Android's share sheet opens (save to Files or Drive, send by email…).
 */
import { isNativeApp } from '../../../lib/platform'
import type { ExportResult } from './dataTransfer'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Returns 'shared' (Android share sheet) or 'downloaded'. */
export async function saveExport(file: ExportResult): Promise<'shared' | 'downloaded'> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const written =
      typeof file.data === 'string'
        ? await Filesystem.writeFile({ path: file.name, data: file.data, directory: Directory.Cache, encoding: Encoding.UTF8 })
        : await Filesystem.writeFile({ path: file.name, data: toBase64(file.data), directory: Directory.Cache })
    try {
      await Share.share({ title: file.name, files: [written.uri], dialogTitle: 'Save your FromZero data' })
    } catch (err) {
      // Closing the share sheet without picking anything isn't an error.
      if (!/cancel/i.test(String((err as Error)?.message ?? err))) throw err
    }
    return 'shared'
  }
  const blob = new Blob([file.data as BlobPart], { type: file.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
