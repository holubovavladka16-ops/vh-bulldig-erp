import { describe, expect, it } from 'vitest'
import { filterProjectMapMarkers } from '@/lib/zakazkyMapa/api'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'
import type { JobOrder } from '@/types/orders'

function makeItem(
  overrides: Omit<Partial<ProjectMapMarkerWithOrder>, 'order'> & { order?: Partial<JobOrder> } = {}
): ProjectMapMarkerWithOrder {
  const baseOrder: JobOrder = {
    id: 'order-1',
    name: 'Rekonstrukce ulice',
    location: 'Brno, Husova 12',
    work_description: 'Výkop',
    start_date: '2026-01-01',
    end_date: '2026-06-01',
    order_number: null,
    short_code: null,
    investor: 'Investor s.r.o.',
    client_name: 'Město Brno',
    contact_person: null,
    phone: null,
    email: null,
    gps_lat: null,
    gps_lng: null,
    gps_accuracy: null,
    note: null,
    status: 'aktivni',
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  const order = { ...baseOrder, ...overrides.order }

  return {
    id: 'marker-1',
    project_id: order.id,
    gps_lat: 49.19,
    gps_lng: 16.61,
    gps_accuracy: null,
    is_approximate: true,
    marker_color: 'green',
    color_source: 'auto',
    color_label: 'Nová zakázka',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
    order,
  }
}

describe('filterProjectMapMarkers', () => {
  const items = [
    makeItem(),
    makeItem({
      id: 'marker-2',
      project_id: 'order-2',
      marker_color: 'red',
      order: {
        id: 'order-2',
        name: 'Praha Vinohrady',
        location: 'Praha 2',
        client_name: 'Objednatel XY',
        investor: null,
      },
    }),
  ]

  it('filtruje podle názvu', () => {
    const result = filterProjectMapMarkers(items, { search: 'vinohrady' })
    expect(result).toHaveLength(1)
    expect(result[0].order.name).toBe('Praha Vinohrady')
  })

  it('filtruje podle objednatele', () => {
    const result = filterProjectMapMarkers(items, { search: 'město brno' })
    expect(result).toHaveLength(1)
    expect(result[0].order.client_name).toBe('Město Brno')
  })

  it('filtruje podle barvy', () => {
    const result = filterProjectMapMarkers(items, { markerColor: 'red' })
    expect(result).toHaveLength(1)
    expect(result[0].marker_color).toBe('red')
  })
})
