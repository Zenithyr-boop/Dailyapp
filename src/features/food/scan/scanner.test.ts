import { describe, expect, it } from 'vitest'
import { expandUpcE } from './scanner'

describe('expandUpcE', () => {
  it('expands UPC-E codes to UPC-A', () => {
    expect(expandUpcE('04252614')).toBe('042100005264')
    expect(expandUpcE('01234505')).toBe('012000003455')
    expect(expandUpcE('01234531')).toBe('012300000451')
  })

  it('leaves other codes alone', () => {
    expect(expandUpcE('3017620422003')).toBe('3017620422003')
    expect(expandUpcE('96385074')).toBe('96385074') // EAN-8
  })
})
