import { describe, expect, it } from 'vitest'
import {
  buildPlaceholderMarkerWithColor,
  resolveAutoMarkerDisplay,
} from '@/lib/zakazkyMapa/markerDisplayColor'
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

const autoMarker: ProjectMapMarker = {
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

const settings = {
  diary_check_time: '20:00:00',
  working_days: [1, 2, 3, 4, 5],
  timezone: 'Europe/Prague',
}

describe('resolveAutoMarkerDisplay', () => {
  it('přepíše zelenou DB barvu na červenou bez záznamu deníku', () => {
    const display = resolveAutoMarkerDisplay(sampleOrder, autoMarker, [], {
      ...settings,
      timezone: 'Europe/Prague',
    })

    expect(display.marker_color).toBe('red')
    expect(display.color_label).toBe('Chybí stavební deník')
    expect(display.color_source).toBe('auto')
  })

  it('ponechá ruční barvu beze změny', () => {
    const manualMarker: ProjectMapMarker = {
      ...autoMarker,
      marker_color: 'green',
      color_source: 'manual',
      color_label: 'Bez problému',
    }

    const display = resolveAutoMarkerDisplay(sampleOrder, manualMarker, [])

    expect(display.marker_color).toBe('green')
    expect(display.color_label).toBe('Bez problému')
    expect(display.color_source).toBe('manual')
  })

  it('vrátí zelenou po prvním zápisu deníku', () => {
    const display = resolveAutoMarkerDisplay(sampleOrder, autoMarker, ['2026-07-22'], settings)

    expect(display.marker_color).toBe('green')
    expect(display.color_label).toBe('Probíhá v pořádku')
  })
})

describe('buildPlaceholderMarkerWithColor', () => {
  it('vytvoří placeholder s červenou barvou bez deníku', () => {
    const marker = buildPlaceholderMarkerWithColor(sampleOrder, [], settings)

    expect(marker.project_id).toBe('order-1')
    expect(marker.marker_color).toBe('red')
    expect(marker.color_label).toBe('Chybí stavební deník')
  })
})
