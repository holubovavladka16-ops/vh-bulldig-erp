import { describe, expect, it } from 'vitest'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'

describe('isValidProjectMarkerGps', () => {
  it('akceptuje platné souřadnice', () => {
    expect(isValidProjectMarkerGps(50.0755, 14.4378)).toBe(true)
  })

  it('odmítne null souřadnice', () => {
    expect(isValidProjectMarkerGps(null, 14.4)).toBe(false)
    expect(isValidProjectMarkerGps(50.1, null)).toBe(false)
  })

  it('odmítne neplatné rozsahy', () => {
    expect(isValidProjectMarkerGps(91, 14)).toBe(false)
    expect(isValidProjectMarkerGps(50, 181)).toBe(false)
    expect(isValidProjectMarkerGps(Number.NaN, 14)).toBe(false)
  })
})
