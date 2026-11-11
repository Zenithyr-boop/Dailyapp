import { checkForUpdate, compareVersions, dismissUpdate, fetchUpdate } from './updates'

const platform = vi.hoisted(() => ({ android: false }))
vi.mock('./platform', () => ({ isNativeApp: () => platform.android, isAndroidApp: () => platform.android }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn(async () => ({ version: '0.2.0' })) } }))

const release = (tag: string, assets = [{ name: 'FromZero-' + tag + '.apk', browser_download_url: `https://dl/${tag}.apk` }]) => ({
  tag_name: tag,
  html_url: `https://github.com/r/releases/tag/${tag}`,
  assets,
})

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch

beforeEach(() => {
  localStorage.clear()
  platform.android = false
})

describe('compareVersions', () => {
  it('compares numerically and ignores a leading v', () => {
    expect(compareVersions('v0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3', 'v1.2.3')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0)
  })
})

describe('fetchUpdate', () => {
  it('offers a newer release with its APK', async () => {
    expect(await fetchUpdate('0.1.0', respond(200, release('v0.2.0')))).toEqual({
      version: '0.2.0',
      downloadUrl: 'https://dl/v0.2.0.apk',
      pageUrl: 'https://github.com/r/releases/tag/v0.2.0',
    })
  })

  it('falls back to the release page without an APK, and offers nothing for the same or older version', async () => {
    expect((await fetchUpdate('0.1.0', respond(200, release('v0.2.0', []))))?.downloadUrl).toBe(
      'https://github.com/r/releases/tag/v0.2.0',
    )
    expect(await fetchUpdate('0.2.0', respond(200, release('v0.2.0')))).toBeNull()
    expect(await fetchUpdate('0.3.0', respond(200, release('v0.2.0')))).toBeNull()
  })

  it('treats "no release yet" as no update and other errors as errors', async () => {
    expect(await fetchUpdate('0.1.0', respond(404))).toBeNull()
    await expect(fetchUpdate('0.1.0', respond(500))).rejects.toThrow()
  })
})

describe('checkForUpdate', () => {
  it('does nothing on the website', async () => {
    const fetchFn = respond(200, release('v9.0.0'))
    expect(await checkForUpdate({ fetchFn })).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('checks once every few hours, honours "Later", and stays quiet offline', async () => {
    platform.android = true
    const fetchFn = respond(200, release('v0.3.0'))
    const now = Date.now()
    expect((await checkForUpdate({ fetchFn, now }))?.version).toBe('0.3.0')
    expect((await checkForUpdate({ fetchFn, now: now + 1000 }))?.version).toBe('0.3.0')
    expect(fetchFn).toHaveBeenCalledTimes(1)

    dismissUpdate('0.3.0')
    expect(await checkForUpdate({ fetchFn, now: now + 2000 })).toBeNull()

    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await checkForUpdate({ fetchFn: offline, now: now + 7 * 3_600_000 })).toBeNull()
  })
})
