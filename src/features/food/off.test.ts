import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { cleanBarcode, fetchProduct, OFF_USER_AGENT, OffError, parseProduct, RateLimiter, searchProducts } from './off'

describe('parseProduct', () => {
  it('reads values per 100 g, brand and servings', () => {
    const food = parseProduct({
      code: '3017620422003',
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      serving_size: '15 g',
      serving_quantity: 15,
      product_quantity: '400',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    })
    expect(food).toEqual({
      id: 'off-3017620422003',
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      per100: { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 },
      servings: [
        { label: '1 serving', grams: 15 },
        { label: '1 package', grams: 400 },
      ],
    })
  })

  it('works out kcal from kJ and flags it', () => {
    const food = parseProduct({
      code: '9421903594204',
      product_name: 'Oat Milk',
      nutriments: { 'energy-kj_100g': 190, proteins_100g: 0.8, carbohydrates_100g: 6.7, fat_100g: 1.7 },
    })
    expect(food?.per100.kcal).toBeCloseTo(45.41, 1)
    expect(food?.kcalFromKj).toBe(true)
    expect(food?.missing).toBeUndefined()
  })

  it('uses per-serving values when there are no per-100 g ones', () => {
    const food = parseProduct({
      code: '12345678',
      product_name: 'Bar',
      serving_size: '1 bar (50 g)',
      serving_quantity: '50',
      nutriments: { 'energy-kcal_serving': 200, proteins_serving: 20, carbohydrates_serving: 15, fat_serving: 7 },
    })
    expect(food?.per100).toEqual({ kcal: 400, proteinG: 40, carbsG: 30, fatG: 14 })
    expect(food?.servings).toEqual([{ label: '1 bar (50 g)', grams: 50 }])
  })

  it('lists what is missing and counts it as 0', () => {
    const food = parseProduct({ code: '12345670', product_name: 'Mystery', nutriments: { proteins_100g: 3 } })
    expect(food?.missing).toEqual(['kcal', 'carbsG', 'fatG'])
    expect(food?.per100).toEqual({ kcal: 0, proteinG: 3, carbsG: 0, fatG: 0 })
  })

  it('rejects products without a valid barcode', () => {
    expect(parseProduct({ code: 'abc', product_name: 'x' })).toBeNull()
  })
})

describe('cleanBarcode', () => {
  it('accepts 8–14 digits, ignoring spaces and dashes', () => {
    expect(cleanBarcode(' 3017 6204-22003 ')).toBe('3017620422003')
    expect(cleanBarcode('1234567')).toBeUndefined()
    expect(cleanBarcode('12345678901234567')).toBeUndefined()
  })
})

describe('RateLimiter', () => {
  it('allows `limit` requests per window, then says how long to wait', () => {
    let now = 0
    const limiter = new RateLimiter(2, 60_000, () => now)
    expect(limiter.take()).toBe(true)
    now = 10_000
    expect(limiter.take()).toBe(true)
    expect(limiter.take()).toBe(false)
    expect(limiter.wait()).toBe(50_000)
    now = 60_000
    expect(limiter.take()).toBe(true)
  })

  it('backs off on server pushback, doubling, and resets after a success', () => {
    let now = 0
    const limiter = new RateLimiter(10, 60_000, () => now)
    expect(limiter.backOff(() => 0.5)).toBe(30_000)
    expect(limiter.take()).toBe(false)
    expect(limiter.backOff(() => 0.5)).toBe(60_000)
    limiter.succeeded()
    now = 120_000
    expect(limiter.backOff(() => 0.5)).toBe(30_000)
  })
})

describe('fetchProduct', () => {
  const fetchMock = vi.fn()

  beforeEach(async () => {
    await db.offProducts.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('identifies the app, caches the product and reads the cache next time', async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ status: 1, product: { product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } } }),
    )
    const food = await fetchProduct('5000000000001')
    expect(food).toMatchObject({ id: 'off-5000000000001', source: 'off', name: 'Skyr' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/api/v2/product/5000000000001.json?fields=')
    expect((init.headers as Record<string, string>)['X-User-Agent']).toBe(OFF_USER_AGENT)

    expect(await fetchProduct('5000000000001')).toMatchObject({ name: 'Skyr' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('remembers barcodes that are not in the database', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 0, status_verbose: 'product not found' }, 404))
    expect(await fetchProduct('5000000000002')).toBeUndefined()
    expect(await fetchProduct('5000000000002')).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a stale copy when offline', async () => {
    await db.offProducts.put({
      barcode: '5000000000003',
      food: { id: 'off-5000000000003', name: 'Old', per100: { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 }, servings: [] },
      fetchedAt: 0,
    })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await fetchProduct('5000000000003')).toMatchObject({ name: 'Old' })
  })

  it('reports rate limiting from the server', async () => {
    fetchMock.mockResolvedValueOnce(reply({}, 429))
    await expect(fetchProduct('5000000000004')).rejects.toBeInstanceOf(OffError)
  })

  it('searches, caches every product and remembers the result list', async () => {
    fetchMock.mockResolvedValueOnce(
      reply({
        count: 2,
        products: [
          { code: '7394376616228', product_name: 'Oat drink', brands: 'Oatly', nutriments: { 'energy-kcal_100g': 61, proteins_100g: 1.1, carbohydrates_100g: 7.1, fat_100g: 3 } },
          { code: '1', product_name: 'Bad code' },
        ],
      }),
    )
    const result = await searchProducts('oat milk')
    expect(result.foods.map((f) => f.name)).toEqual(['Oat drink'])
    expect(String(fetchMock.mock.calls[0]![0])).toContain('search_terms=oat+milk')
    expect(await db.offProducts.get('7394376616228')).toBeDefined()
    await searchProducts('Oat milk ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
