import { describe, expect, it } from 'vitest'
import { getDefaultErpPath, hasModuleAccess } from '@/constants/permissions'

describe('majitel permissions (Fáze 1j)', () => {
  it('přesměruje na mapu zakázek po přihlášení', () => {
    expect(getDefaultErpPath('majitel')).toBe('/zakazky-mapa')
  })

  it('má přístup k modulům zakázek a mapy', () => {
    expect(hasModuleAccess('majitel', 'zakazky-mapa')).toBe(true)
    expect(hasModuleAccess('majitel', 'zakazky')).toBe(true)
    expect(hasModuleAccess('majitel', 'denik')).toBe(true)
  })

  it('nemá přístup k dashboardu a administraci', () => {
    expect(hasModuleAccess('majitel', 'dashboard')).toBe(false)
    expect(hasModuleAccess('majitel', 'nastaveni')).toBe(false)
    expect(hasModuleAccess('majitel', 'delnici')).toBe(false)
  })
})
