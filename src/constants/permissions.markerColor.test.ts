import { describe, expect, it } from 'vitest'
import {
  canEditMarkerColor,
  isAdministrator,
  isMajitel,
  isStavbyvedouci,
  isUcetni,
} from '@/constants/permissions'
import type { UserRole } from '@/types'

describe('canEditMarkerColor', () => {
  it('povolí administrátorovi', () => {
    expect(canEditMarkerColor('administrator')).toBe(true)
    expect(isAdministrator('administrator')).toBe(true)
  })

  it('povolí majiteli', () => {
    expect(canEditMarkerColor('majitel')).toBe(true)
    expect(isMajitel('majitel')).toBe(true)
  })

  it('nepovolí stavbyvedoucímu', () => {
    expect(canEditMarkerColor('stavbyvedouci')).toBe(false)
    expect(isStavbyvedouci('stavbyvedouci')).toBe(true)
  })

  it('nepovolí účetní', () => {
    expect(canEditMarkerColor('ucetni')).toBe(false)
    expect(isUcetni('ucetni')).toBe(true)
  })

  it('nepovolí ostatním rolím', () => {
    const denied: UserRole[] = ['vedouci', 'delnik']
    for (const role of denied) {
      expect(canEditMarkerColor(role)).toBe(false)
    }
  })
})
