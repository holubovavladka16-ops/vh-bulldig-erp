import { describe, expect, it } from 'vitest'
import { formatMarkerColorState } from '@/lib/zakazkyMapa/markerColorHistory'
import {
  PROJECT_MARKER_AUTO_COLOR_LABELS,
  PROJECT_MARKER_CHANGE_TYPE_LABELS,
  PROJECT_MARKER_MANUAL_COLOR_LABELS,
  PROJECT_MARKER_MANUAL_COLOR_OPTIONS,
  PROJECT_MARKER_REVERT_AUTO_REASON,
} from '@/constants/zakazkyMapa'

describe('PROJECT_MARKER_MANUAL_COLOR_OPTIONS', () => {
  it('obsahuje čtyři ruční stavy s emoji', () => {
    expect(PROJECT_MARKER_MANUAL_COLOR_OPTIONS).toHaveLength(4)
    expect(PROJECT_MARKER_MANUAL_COLOR_OPTIONS.map((option) => option.value)).toEqual([
      'green',
      'orange',
      'red',
      'blue',
    ])
  })

  it('mapuje ruční popisky podle specifikace 1f', () => {
    expect(PROJECT_MARKER_MANUAL_COLOR_LABELS.green).toBe('Bez problému')
    expect(PROJECT_MARKER_MANUAL_COLOR_LABELS.orange).toBe('Vyžaduje pozornost')
    expect(PROJECT_MARKER_MANUAL_COLOR_LABELS.red).toBe('Kritický problém')
    expect(PROJECT_MARKER_MANUAL_COLOR_LABELS.blue).toBe('Čeká na zahájení')
  })

  it('odděluje automatické a ruční popisky', () => {
    expect(PROJECT_MARKER_AUTO_COLOR_LABELS.green).toBe('Probíhá v pořádku')
    expect(PROJECT_MARKER_MANUAL_COLOR_LABELS.green).toBe('Bez problému')
  })

  it('má popisky typů změn', () => {
    expect(PROJECT_MARKER_CHANGE_TYPE_LABELS.auto).toBe('Automaticky')
    expect(PROJECT_MARKER_CHANGE_TYPE_LABELS.manual).toBe('Ručně')
  })

  it('má důvod pro vrácení na automatiku', () => {
    expect(PROJECT_MARKER_REVERT_AUTO_REASON).toBe('Vráceno na automatický výpočet')
  })
})

describe('formatMarkerColorState', () => {
  it('vrátí label nebo barvu', () => {
    expect(formatMarkerColorState('green', 'Bez problému')).toBe('Bez problému')
    expect(formatMarkerColorState('red', null)).toBe('red')
  })

  it('vrátí pomlčku pro prázdnou barvu', () => {
    expect(formatMarkerColorState(null, null)).toBe('—')
  })
})
