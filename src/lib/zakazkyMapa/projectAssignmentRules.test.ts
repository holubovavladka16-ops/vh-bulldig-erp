import { describe, expect, it } from 'vitest'
import {
  canEditMarkerColor,
  canManageProjectAssignments,
  getDefaultErpPath,
  hasModuleAccess,
  isStavbyvedouci,
} from '@/constants/permissions'
import {
  countActivePrimaryAssignments,
  findActivePrimaryAssignment,
  isActiveProjectAssignment,
} from '@/lib/zakazkyMapa/projectAssignmentRules'
import type { ProjectUserAssignment } from '@/types/projectAssignments'

describe('stavbyvedouci permissions (Fáze 1g)', () => {
  it('umožní ERP přístup Stavbyvedoucímu', () => {
    expect(hasModuleAccess('stavbyvedouci', 'zakazky-mapa')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'denik')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'dochazka')).toBe(true)
    expect(getDefaultErpPath('stavbyvedouci')).toBe('/zakazky-mapa')
  })

  it('blokuje administraci a fakturaci', () => {
    expect(hasModuleAccess('stavbyvedouci', 'dashboard')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'ekonomika')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'nastaveni')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'gps-fotoarchiv')).toBe(false)
  })

  it('nepovolí ruční barvu ani správu přiřazení', () => {
    expect(canEditMarkerColor('stavbyvedouci')).toBe(false)
    expect(canManageProjectAssignments('stavbyvedouci')).toBe(false)
    expect(isStavbyvedouci('stavbyvedouci')).toBe(true)
  })

  it('umožní správu přiřazení Adminovi a Majiteli', () => {
    expect(canManageProjectAssignments('administrator')).toBe(true)
    expect(canManageProjectAssignments('majitel')).toBe(true)
  })

  it('nemění roli vedouci', () => {
    expect(hasModuleAccess('vedouci', 'zakazky')).toBe(false)
    expect(canManageProjectAssignments('vedouci')).toBe(false)
  })
})

describe('project assignment rules', () => {
  const base: ProjectUserAssignment = {
    id: 'a1',
    project_id: 'p1',
    user_id: 'u1',
    is_primary: true,
    valid_from: '2026-01-01',
    valid_to: null,
    is_active: true,
    assigned_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
  }

  it('respektuje platnost od–do a is_active', () => {
    expect(isActiveProjectAssignment(base, '2026-07-22')).toBe(true)
    expect(isActiveProjectAssignment({ ...base, is_active: false }, '2026-07-22')).toBe(false)
    expect(isActiveProjectAssignment({ ...base, valid_from: '2026-08-01' }, '2026-07-22')).toBe(false)
    expect(isActiveProjectAssignment({ ...base, valid_to: '2026-07-01' }, '2026-07-22')).toBe(false)
  })

  it('umožní jen jednoho aktivního hlavního', () => {
    const rows: ProjectUserAssignment[] = [
      base,
      { ...base, id: 'a2', user_id: 'u2', is_primary: true, is_active: false },
    ]
    expect(countActivePrimaryAssignments(rows, '2026-07-22')).toBe(1)
    expect(findActivePrimaryAssignment(rows, '2026-07-22')?.user_id).toBe('u1')
  })
})
