import { describe, expect, it } from 'vitest'
import { buildGeocodeQueryFromOrder } from '@/lib/zakazkyMapa/geocodeQuery'

describe('buildGeocodeQueryFromOrder', () => {
  it('doplní Česko pro město', () => {
    expect(buildGeocodeQueryFromOrder({ location: 'Brno', name: 'Zakázka Brno' })).toBe('Brno, Česko')
  })

  it('doplní Česko pro úplnou adresu', () => {
    expect(
      buildGeocodeQueryFromOrder({
        location: 'Husova 12, Praha',
        name: 'Rekonstrukce',
      })
    ).toBe('Husova 12, Praha, Česko')
  })

  it('neupraví dotaz, který už obsahuje zemi', () => {
    expect(
      buildGeocodeQueryFromOrder({ location: 'Hodonín, Česko', name: 'Test' })
    ).toBe('Hodonín, Česko')
  })

  it('vrátí null bez místa realizace', () => {
    expect(buildGeocodeQueryFromOrder({ location: '', name: 'Bez místa' })).toBeNull()
  })
})
