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

const noDiaryContext = { approvedDiaryDates: [], anyDiaryCount: 0 }

describe('resolveAutoMarkerDisplay', () => {
  it('aktivní zakázka bez deníku je červená – stav active neznamená green', () => {
    const display = resolveAutoMarkerDisplay(sampleOrder, autoMarker, noDiaryContext, settings)

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

    const display = resolveAutoMarkerDisplay(sampleOrder, manualMarker, noDiaryContext)

    expect(display.marker_color).toBe('green')
    expect(display.color_label).toBe('Bez problému')
    expect(display.color_source).toBe('manual')
  })

  it('vrátí zelenou se schváleným deníkem pro dnešek', () => {
    const display = resolveAutoMarkerDisplay(
      sampleOrder,
      autoMarker,
      { approvedDiaryDates: ['2026-07-22'], anyDiaryCount: 1 },
      settings
    )

    expect(display.marker_color).toBe('green')
    expect(display.color_label).toBe('Probíhá v pořádku')
  })

  it('červená i když existuje ne schválený zápis', () => {
    const display = resolveAutoMarkerDisplay(
      sampleOrder,
      autoMarker,
      { approvedDiaryDates: [], anyDiaryCount: 2 },
      settings
    )

    expect(display.marker_color).toBe('red')
  })
})

describe('buildPlaceholderMarkerWithColor', () => {
  it('vytvoří placeholder s červenou barvou bez deníku', () => {
    const marker = buildPlaceholderMarkerWithColor(sampleOrder, noDiaryContext, settings)

    expect(marker.project_id).toBe('order-1')
    expect(marker.marker_color).toBe('red')
    expect(marker.color_label).toBe('Chybí stavební deník')
  })
})
