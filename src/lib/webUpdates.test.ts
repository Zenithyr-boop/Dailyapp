import { BUILD_INFO } from './buildInfo'

const platform = { native: false }
const registerSW = vi.fn((options: { onNeedRefresh?: () => void }) => {
  hooks.onNeedRefresh = options.onNeedRefresh
  return updateSW
})
const updateSW = vi.fn(async () => {})
const hooks: { onNeedRefresh?: () => void } = {}

vi.mock('./platform', () => ({ isNativeApp: () => platform.native, isAndroidApp: () => platform.native }))
vi.mock('virtual:pwa-register', () => ({ registerSW }))

/** Each test gets a fresh module (it keeps state: started, last check, the waiting worker). */
async function load() {
  vi.resetModules()
  return import('./webUpdates')
}

function versionJson(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response)
}

beforeEach(() => {
  platform.native = false
  registerSW.mockClear()
  updateSW.mockClear()
  hooks.onNeedRefresh = undefined
  vi.stubGlobal('fetch', versionJson(BUILD_INFO))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startWebUpdates', () => {
  it('registers the service worker on the website', async () => {
    const { startWebUpdates } = await load()
    startWebUpdates()
    await vi.waitFor(() => expect(registerSW).toHaveBeenCalledTimes(1))
  })

  it('never registers a service worker in the Android app', async () => {
    platform.native = true
    const { startWebUpdates, checkWebUpdate } = await load()
    startWebUpdates()
    expect(registerSW).not.toHaveBeenCalled()
    expect(await checkWebUpdate({ force: true })).toBe('latest')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('checkWebUpdate', () => {
  it('fetches /version.json past every cache', async () => {
    const { checkWebUpdate } = await load()
    const fetchFn = versionJson(BUILD_INFO)
    expect(await checkWebUpdate({ force: true, fetchFn })).toBe('latest')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/^\/version\.json\?t=\d+$/)
    expect(init.cache).toBe('no-store')
  })

  it('reports a newer version', async () => {
    const { checkWebUpdate, getWebUpdate } = await load()
    const remote = { ...BUILD_INFO, version: '99.0.0' }
    expect(await checkWebUpdate({ force: true, fetchFn: versionJson(remote) })).toBe('update')
    expect(getWebUpdate()).toMatchObject({ available: true, waiting: false, remote })
  })

  it('ignores a page that is not version.json, and says when offline', async () => {
    const { checkWebUpdate } = await load()
    expect(await checkWebUpdate({ force: true, fetchFn: versionJson('<html>') })).toBe('latest')
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await checkWebUpdate({ force: true, fetchFn: offline })).toBe('offline')
  })

  it('checks at most once a minute when coming back into view', async () => {
    const { checkWebUpdate } = await load()
    const fetchFn = versionJson(BUILD_INFO)
    await checkWebUpdate({ now: 1_000_000, fetchFn })
    await checkWebUpdate({ now: 1_030_000, fetchFn })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    await checkWebUpdate({ now: 1_061_000, fetchFn })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})

describe('applyWebUpdate', () => {
  it('activates the waiting service worker (which reloads the page)', async () => {
    const { startWebUpdates, applyWebUpdate, getWebUpdate } = await load()
    startWebUpdates()
    await vi.waitFor(() => expect(registerSW).toHaveBeenCalledTimes(1))
    hooks.onNeedRefresh?.()
    expect(getWebUpdate()).toMatchObject({ available: true, waiting: true })
    await applyWebUpdate({ reload: vi.fn() })
    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('just reloads when there is no service worker', async () => {
    const { applyWebUpdate } = await load()
    const reload = vi.fn()
    await applyWebUpdate({ reload })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(updateSW).not.toHaveBeenCalled()
  })
})
