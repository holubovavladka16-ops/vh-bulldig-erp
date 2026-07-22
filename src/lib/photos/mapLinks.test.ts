import { describe, expect, it } from 'vitest'
import { getMapyCzPanoramaUrl, getMapyCzUrl } from '@/lib/photos/mapLinks'

describe('mapLinks – Mapy.cz', () => {
  const lat = 50.0755381
  const lng = 14.4378005

  it('generuje odkaz na mapu se špendlíkem na souřadnicích', () => {
    const url = getMapyCzUrl(lat, lng)
    expect(url).toMatch(/^https:\/\/mapy\.com\/zakladni\?/)
    expect(url).toContain('source=coor')
    expect(url).toContain('x=14.4378005')
    expect(url).toContain('y=50.0755381')
    expect(url).toContain(encodeURIComponent('14.4378005,50.0755381'))
  })

  it('generuje odkaz na panoramu (ulice) na souřadnicích', () => {
    const url = getMapyCzPanoramaUrl(lat, lng)
    expect(url).toMatch(/^https:\/\/mapy\.com\/zakladni\?/)
    expect(url).toContain('pano=1')
    expect(url).toContain('source=coor')
    expect(url).toContain('ds=1')
    expect(url).toContain(encodeURIComponent('14.4378005,50.0755381'))
  })
})
