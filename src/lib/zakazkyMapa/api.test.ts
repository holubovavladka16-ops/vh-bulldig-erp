import { describe, expect, it } from 'vitest'
import { buildPlaceholderMarker } from '@/lib/zakazkyMapa/api'
import type { JobOrder } from '@/types/orders'

const sampleOrder: JobOrder = {
  id: 'order-1',
  name: 'Test zakázka',
  location: 'Praha',
  work_description: '',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  order_number: null,
  short_code: null,
  investor: null,
  client_name: null,
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

describe('buildPlaceholderMarker', () => {
  it('vytvoří placeholder pro přiřazenou zakázku bez špendlíku', () => {
    const marker = buildPlaceholderMarker(sampleOrder)
    expect(marker.project_id).toBe('order-1')
    expect(marker.gps_lat).toBeNull()
    expect(marker.marker_color).toBe('green')
    expect(marker.id).toContain('placeholder')
  })
})
