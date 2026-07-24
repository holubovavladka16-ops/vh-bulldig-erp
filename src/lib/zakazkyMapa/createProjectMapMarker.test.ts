import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildProjectMapMarkerInsert,
  resolveMarkerGpsFromOrderFields,
  resolveProjectMarkerGps,
} from '@/lib/zakazkyMapa/createProjectMapMarker'
import { forwardGeocode } from '@/lib/photos/geocoding'

vi.mock('@/lib/photos/geocoding', () => ({
  forwardGeocode: vi.fn(),
}))

const mockedForwardGeocode = vi.mocked(forwardGeocode)

describe('resolveMarkerGpsFromOrderFields', () => {
  it('preferuje GPS souřadnice ze zakázky', () => {
    const result = resolveMarkerGpsFromOrderFields({
      gps_lat: 50.1,
      gps_lng: 14.4,
      gps_accuracy: 5,
      location: 'Praha',
    })

    expect(result).toEqual({
      gps_lat: 50.1,
      gps_lng: 14.4,
      gps_accuracy: 5,
      is_approximate: false,
    })
  })

  it('označí nepřesné GPS jako přibližné', () => {
    const result = resolveMarkerGpsFromOrderFields({
      gps_lat: 50.1,
      gps_lng: 14.4,
      gps_accuracy: 50,
      location: 'Praha',
    })

    expect(result).toEqual({
      gps_lat: 50.1,
      gps_lng: 14.4,
      gps_accuracy: 50,
      is_approximate: true,
    })
  })

  it('bez GPS s místem vrátí geocode', () => {
    expect(
      resolveMarkerGpsFromOrderFields({
        location: 'Brno, Husova 12',
      })
    ).toBe('geocode')
  })

  it('bez GPS a bez místa vrátí neúplný špendlík', () => {
    expect(resolveMarkerGpsFromOrderFields({ location: '' })).toEqual({
      gps_lat: null,
      gps_lng: null,
      gps_accuracy: null,
      is_approximate: true,
    })
  })
})

describe('resolveProjectMarkerGps', () => {
  beforeEach(() => {
    mockedForwardGeocode.mockReset()
  })

  it('geokóduje místo realizace', async () => {
    mockedForwardGeocode.mockResolvedValue({
      lat: 49.195,
      lng: 16.607,
      display_name: 'Brno',
    })

    const result = await resolveProjectMarkerGps({ location: 'Brno' })

    expect(mockedForwardGeocode).toHaveBeenCalledWith('Brno')
    expect(result).toEqual({
      gps_lat: 49.195,
      gps_lng: 16.607,
      gps_accuracy: null,
      is_approximate: true,
    })
  })

  it('při selhání geokódování vrátí neúplný špendlík', async () => {
    mockedForwardGeocode.mockResolvedValue(null)

    const result = await resolveProjectMarkerGps({ location: 'Neexistující adresa XYZ' })

    expect(result).toEqual({
      gps_lat: null,
      gps_lng: null,
      gps_accuracy: null,
      is_approximate: true,
    })
  })

  it('ignoruje chybu geokódování', async () => {
    mockedForwardGeocode.mockRejectedValue(new Error('network'))

    const result = await resolveProjectMarkerGps({ location: 'Praha' })

    expect(result.gps_lat).toBeNull()
    expect(result.is_approximate).toBe(true)
  })
})

describe('buildProjectMapMarkerInsert', () => {
  it('nastaví výchozí hodnoty špendlíku', () => {
    const payload = buildProjectMapMarkerInsert('order-uuid', {
      gps_lat: 50,
      gps_lng: 14,
      gps_accuracy: null,
      is_approximate: true,
    })

    expect(payload).toEqual({
      project_id: 'order-uuid',
      gps_lat: 50,
      gps_lng: 14,
      gps_accuracy: null,
      is_approximate: true,
      marker_color: 'red',
      color_source: 'auto',
      color_label: 'Chybí stavební deník',
    })
  })
})
