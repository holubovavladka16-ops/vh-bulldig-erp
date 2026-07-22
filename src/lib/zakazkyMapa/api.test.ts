import { describe, expect, it } from 'vitest'
import { buildPlaceholderMarker, mergeMarkerWithOrder } from '@/lib/zakazkyMapa/api'
import type { JobOrder } from '@/types/orders'
import type { ProjectMapMarker } from '@/types/zakazkyMapa'

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

const sampleMarker: ProjectMapMarker = {
  id: 'marker-1',
  project_id: 'order-1',
  gps_lat: null,
  gps_lng: null,
  gps_accuracy: null,
  is_approximate: true,
  marker_color: 'green',
  color_source: 'auto',
  color_label: 'Nová zakázka',
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

describe('mergeMarkerWithOrder', () => {
  it('doplní GPS ze zakázky, pokud marker nemá souřadnice', () => {
    const order: JobOrder = {
      ...sampleOrder,
      gps_lat: 50.0755,
      gps_lng: 14.4378,
      gps_accuracy: 8,
    }

    const merged = mergeMarkerWithOrder(sampleMarker, order)

    expect(merged.gps_lat).toBe(50.0755)
    expect(merged.gps_lng).toBe(14.4378)
    expect(merged.is_approximate).toBe(false)
  })

  it('ponechá GPS markeru, pokud už existuje', () => {
    const marker: ProjectMapMarker = {
      ...sampleMarker,
      gps_lat: 49.2,
      gps_lng: 16.6,
      gps_accuracy: null,
    }
    const order: JobOrder = {
      ...sampleOrder,
      gps_lat: 50.0,
      gps_lng: 14.0,
    }

    const merged = mergeMarkerWithOrder(marker, order)

    expect(merged.gps_lat).toBe(49.2)
    expect(merged.gps_lng).toBe(16.6)
  })
})
