import { describe, expect, it } from 'vitest'
import { getDefaultErpPath, hasModuleAccess } from '@/constants/permissions'

describe('majitel permissions', () => {
  it('přesměruje na hlavní Dashboard po přihlášení', () => {
    expect(getDefaultErpPath('majitel')).toBe('/')
  })

  it('má přístup ke všem modulům ERP', () => {
    expect(hasModuleAccess('majitel', 'dashboard')).toBe(true)
    expect(hasModuleAccess('majitel', 'zakazky-mapa')).toBe(true)
    expect(hasModuleAccess('majitel', 'zakazky')).toBe(true)
    expect(hasModuleAccess('majitel', 'denik')).toBe(true)
    expect(hasModuleAccess('majitel', 'dochazka')).toBe(true)
    expect(hasModuleAccess('majitel', 'vykazy')).toBe(true)
    expect(hasModuleAccess('majitel', 'ekonomika')).toBe(true)
    expect(hasModuleAccess('majitel', 'fakturovac')).toBe(true)
    expect(hasModuleAccess('majitel', 'denni-kalendar')).toBe(true)
    expect(hasModuleAccess('majitel', 'nastaveni')).toBe(true)
    expect(hasModuleAccess('majitel', 'delnici')).toBe(true)
  })
})
