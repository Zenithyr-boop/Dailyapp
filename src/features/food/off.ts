/**
 * Open Food Facts client: packaged foods by barcode and by name.
 *
 * Their API rules (openfoodfacts.github.io/openfoodfacts-server/api):
 * - Identify the app as `AppName/Version (contact)`. Browsers can't set
 *   User-Agent, so it goes in `X-User-Agent` (their CORS setup allows it).
 * - Limits per user: 15 product reads and 10 searches a minute. Searching is not
 *   for search-as-you-type, so the app only searches when the user submits.
 *   A client-side limiter keeps us under both, and 429/503 answers back off.
 * - Test against the staging server (world.openfoodfacts.net, login off/off):
 *   the dev server uses it unless `VITE_OFF_SERVER=production`.
 * - Data is ODbL: credited on Me → About.
 *
 * Every product fetched is cached on the device (`offProducts`), so a second
 * scan or a cached search result costs nothing and works offline.
 */
import { db, type FoodSnapshot, type Nutrient, type Per100, type Serving } from '../../lib/db'
import { NUTRIENTS, snapshotOf, type Food } from './nutrition'

export const OFF_PREFIX = 'off-'
export const OFF_USER_AGENT = 'FromZero/0.1.0 (https://fromzero-ce670.web.app)'

const PRODUCTION = 'https://world.openfoodfacts.org'
const STAGING = 'https://world.openfoodfacts.net'

const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',')

/** Cached products are refreshed after this long (when online). */
const FRESH_MS = 30 * 24 * 60 * 60 * 1000
/** A barcode that wasn't found is asked again after a day. */
const NOT_FOUND_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 15_000
const SEARCH_PAGE_SIZE = 24

function onStaging(): boolean {
  const server = import.meta.env.VITE_OFF_SERVER as string | undefined
  if (server === 'staging') return true
  if (server === 'production') return false
  return import.meta.env.DEV && import.meta.env.MODE !== 'test'
}

function baseUrl(): string {
  return onStaging() ? STAGING : PRODUCTION
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'X-User-Agent': OFF_USER_AGENT, Accept: 'application/json' }
  if (onStaging()) h.Authorization = `Basic ${btoa('off:off')}`
  return h
}

// ---- Rate limiting -----------------------------------------------------------------

/** Sliding-window limiter: at most `limit` requests per `windowMs`, plus server-requested pauses. */
export class RateLimiter {
  private times: number[] = []
  private blockedUntil = 0
  private failures = 0
  readonly limit: number
  readonly windowMs: number
  private readonly now: () => number

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }

  /** Milliseconds until a request may go out (0 = now). */
  wait(): number {
    const t = this.now()
    this.times = this.times.filter((x) => t - x < this.windowMs)
    const blocked = Math.max(0, this.blockedUntil - t)
    if (this.times.length < this.limit) return blocked
    return Math.max(blocked, this.times[0]! + this.windowMs - t)
  }

  /** Use one request if allowed. */
  take(): boolean {
    if (this.wait() > 0) return false
    this.times.push(this.now())
    return true
  }

  /** The server said slow down: wait 30 s, doubling (with jitter) on repeats, up to 5 min. */
  backOff(random: () => number = Math.random): number {
    const base = Math.min(300_000, 30_000 * 2 ** this.failures)
    this.failures++
    const ms = Math.round(base * (0.8 + 0.4 * random()))
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms)
    return ms
  }

  succeeded(): void {
    this.failures = 0
  }
}

// One under each documented limit, to leave room for clock differences.
const searchLimiter = new RateLimiter(9, 60_000)
const productLimiter = new RateLimiter(14, 60_000)

export type OffErrorKind = 'rate' | 'offline' | 'server' | 'invalid'

export class OffError extends Error {
  readonly kind: OffErrorKind
  /** For `rate`: how long until trying again makes sense. */
  readonly retryInMs?: number

  constructor(kind: OffErrorKind, message: string, retryInMs?: number) {
    super(message)
    this.name = 'OffError'
    this.kind = kind
    this.retryInMs = retryInMs
  }
}

/** A short sentence for the user. */
export function offErrorText(error: unknown): string {
  if (error instanceof OffError) {
    if (error.kind === 'rate') {
      const s = Math.max(1, Math.ceil((error.retryInMs ?? 60_000) / 1000))
      return `Open Food Facts limits how often apps can ask. Try again in ${s} s.`
    }
    if (error.kind === 'offline') return 'You’re offline. Packaged foods need a connection (ones you’ve seen before still work).'
    if (error.kind === 'invalid') return error.message
  }
  return 'Open Food Facts didn’t answer. Try again in a moment.'
}

async function request(url: string, limiter: RateLimiter): Promise<Response | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OffError('offline', 'offline')
  if (!limiter.take()) throw new OffError('rate', 'rate limited', limiter.wait())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, { headers: headers(), signal: controller.signal })
  } catch {
    throw new OffError('offline', 'network error')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 429 || res.status === 503) {
    throw new OffError('rate', `server busy (${res.status})`, limiter.backOff())
  }
  limiter.succeeded()
  if (res.status === 404) return null
  if (!res.ok) throw new OffError('server', `HTTP ${res.status}`)
  return res
}

// ---- Parsing ------------------------------------------------------------------------

type Raw = Record<string, unknown>

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined
}

function text(v: unknown, max = 80): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : undefined
}

const KEYS: Record<Nutrient, string> = { kcal: 'energy-kcal', proteinG: 'proteins', carbsG: 'carbohydrates', fatG: 'fat' }

/** Barcodes are 8–14 digits (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function cleanBarcode(input: string): string | undefined {
  const digits = input.replace(/[\s-]/g, '')
  return /^\d{8,14}$/.test(digits) ? digits : undefined
}

/**
 * An Open Food Facts product → a food. Values per 100 g come from `*_100g`,
 * else from `*_serving` with the serving weight. Calories fall back to kJ
 * (÷ 4.184, flagged). Anything still unknown is listed in `missing` and counted as 0.
 */
export function parseProduct(raw: Raw): FoodSnapshot | null {
  const code = typeof raw.code === 'string' ? cleanBarcode(raw.code) : undefined
  if (!code) return null
  const n = (raw.nutriments ?? {}) as Raw
  const servingG = num(raw.serving_quantity)

  const per100Of = (key: string): number | undefined => {
    const direct = num(n[`${key}_100g`])
    if (direct !== undefined) return direct
    const perServing = num(n[`${key}_serving`])
    return perServing !== undefined && servingG ? (perServing * 100) / servingG : undefined
  }

  const values: Partial<Per100> = {}
  for (const k of NUTRIENTS) values[k] = per100Of(KEYS[k])
  let kcalFromKj = false
  if (values.kcal === undefined) {
    const kj = per100Of('energy-kj') ?? (n.energy_unit === 'kcal' ? undefined : per100Of('energy'))
    if (kj !== undefined) {
      values.kcal = kj / 4.184
      kcalFromKj = true
    }
  }
  const missing = NUTRIENTS.filter((k) => values[k] === undefined)
  const round = (v: number | undefined) => Math.round((v ?? 0) * 100) / 100

  const servings: Serving[] = []
  if (servingG && servingG <= 2000) {
    const size = text(raw.serving_size, 40)
    const justWeight = !size || /^[\d.,\s]+(g|ml|gr|grams?)$/i.test(size)
    servings.push({ label: justWeight ? '1 serving' : size, grams: Math.round(servingG * 10) / 10 })
  }
  const packG = num(raw.product_quantity)
  if (packG && packG <= 2000 && packG !== servingG) {
    servings.push({ label: '1 package', grams: Math.round(packG * 10) / 10 })
  }

  const food: FoodSnapshot = {
    id: `${OFF_PREFIX}${code}`,
    barcode: code,
    name: text(raw.product_name) ?? text(raw.product_name_en) ?? text(raw.generic_name) ?? 'Unnamed product',
    per100: { kcal: round(values.kcal), proteinG: round(values.proteinG), carbsG: round(values.carbsG), fatG: round(values.fatG) },
    servings,
  }
  const brand = text(typeof raw.brands === 'string' ? raw.brands.split(',')[0] : undefined, 40)
  if (brand) food.brand = brand
  if (missing.length) food.missing = missing
  if (kcalFromKj) food.kcalFromKj = true
  return food
}

export function offFood(snapshot: FoodSnapshot): Food {
  return { ...snapshot, source: 'off' }
}

// ---- Cache --------------------------------------------------------------------------

async function cache(foods: (FoodSnapshot | null)[], codes: string[]): Promise<void> {
  const now = Date.now()
  await db.offProducts.bulkPut(codes.map((barcode, i) => ({ barcode, food: foods[i] ? snapshotOf(foods[i]!) : null, fetchedAt: now })))
}

/** A product already on the device (any age). */
export async function getCachedProduct(id: string): Promise<Food | undefined> {
  if (!id.startsWith(OFF_PREFIX)) return undefined
  const row = await db.offProducts.get(id.slice(OFF_PREFIX.length))
  return row?.food ? offFood(row.food) : undefined
}

/** Every product cached on the device, for searching offline. */
export async function cachedProducts(): Promise<Food[]> {
  const rows = await db.offProducts.toArray()
  return rows.flatMap((r) => (r.food ? [offFood(r.food)] : []))
}

// ---- Lookups ------------------------------------------------------------------------

/**
 * A product by barcode: from the device cache when fresh, else from Open Food
 * Facts (then cached). Undefined = not in their database. Offline, a stale
 * cached copy is better than nothing.
 */
export async function fetchProduct(barcode: string, now = Date.now()): Promise<Food | undefined> {
  const code = cleanBarcode(barcode)
  if (!code) throw new OffError('invalid', 'A barcode is 8 to 14 digits.')
  const cached = await db.offProducts.get(code)
  if (cached) {
    const age = now - cached.fetchedAt
    if (cached.food && age < FRESH_MS) return offFood(cached.food)
    if (!cached.food && age < NOT_FOUND_MS) return undefined
  }
  try {
    const res = await request(`${baseUrl()}/api/v2/product/${code}.json?fields=${FIELDS}`, productLimiter)
    const json = res ? ((await res.json()) as Raw) : null
    const product = json && json.status !== 0 && json.product ? parseProduct({ code, ...(json.product as Raw) }) : null
    await cache([product], [code])
    return product ? offFood(product) : undefined
  } catch (error) {
    if (cached?.food) return offFood(cached.food)
    throw error
  }
}

export interface OffSearchResult {
  foods: Food[]
  /** Total matches Open Food Facts reports. */
  count: number
}

const recentSearches = new Map<string, { at: number; result: OffSearchResult }>()
const SEARCH_MEMO_MS = 10 * 60 * 1000

/** Packaged foods by name. Results are cached (products on the device, the list for 10 minutes). */
export async function searchProducts(query: string, page = 1): Promise<OffSearchResult> {
  const q = query.trim().replace(/\s+/g, ' ')
  if (q.length < 2) return { foods: [], count: 0 }
  const memoKey = `${q.toLowerCase()}|${page}`
  const memo = recentSearches.get(memoKey)
  if (memo && Date.now() - memo.at < SEARCH_MEMO_MS) return memo.result

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(SEARCH_PAGE_SIZE),
    page: String(page),
    fields: FIELDS,
  })
  const res = await request(`${baseUrl()}/cgi/search.pl?${params}`, searchLimiter)
  const json = res ? ((await res.json()) as { count?: unknown; products?: unknown }) : {}
  const products = Array.isArray(json.products) ? (json.products as Raw[]) : []
  const foods = products.map(parseProduct).filter((f): f is FoodSnapshot => f !== null && f.name !== 'Unnamed product')
  await cache(foods, foods.map((f) => f.barcode!))
  const result = { foods: foods.map(offFood), count: num(json.count) ?? foods.length }
  recentSearches.set(memoKey, { at: Date.now(), result })
  return result
}
