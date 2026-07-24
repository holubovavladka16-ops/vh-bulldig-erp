import { describe, expect, it } from 'vitest'
import {
  getDefaultErpPath,
  hasModuleAccess,
  isStavbyvedouciRouteAllowed,
  shouldRedirectStavbyvedouci,
} from '@/constants/permissions'
import { canStavbyvedouciEditDiary } from '@/lib/stavbyvedouci/api'
import type { ConstructionDiaryEntry } from '@/types/diary'

describe('stavbyvedouci route protection (Fáze 1h)', () => {
  it('přesměruje na /stavbyvedouci po přihlášení', () => {
    expect(getDefaultErpPath('stavbyvedouci')).toBe('/stavbyvedouci')
  })

  it('povolí pracovní routy', () => {
    expect(isStavbyvedouciRouteAllowed('/stavbyvedouci')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/stavbyvedouci/dochazka')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/stavbyvedouci/naklad')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/stavbyvedouci/denik')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/stavbyvedouci/zakazky')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/zakazky-mapa')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/zakazky/abc-123')).toBe(true)
    expect(isStavbyvedouciRouteAllowed('/nastaveni/profil')).toBe(true)
  })

  it('blokuje nepovolené routy', () => {
    expect(shouldRedirectStavbyvedouci('/')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/dashboard')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/fakturace')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/nastaveni')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/administrace')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/zaloha')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/zamestnanci')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/ekonomika')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/dochazka')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/denik')).toBe(true)
    expect(shouldRedirectStavbyvedouci('/zakazky')).toBe(true)
  })

  it('vidí pouze povolené moduly', () => {
    expect(hasModuleAccess('stavbyvedouci', 'stavbyvedouci')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'zakazky-mapa')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'zakazky')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'nastaveni-profil')).toBe(true)
    expect(hasModuleAccess('stavbyvedouci', 'dashboard')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'ekonomika')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'denik')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'dochazka')).toBe(false)
    expect(hasModuleAccess('stavbyvedouci', 'nastaveni')).toBe(false)
  })
})

describe('stavbyvedouci diary edit rules', () => {
  const base: ConstructionDiaryEntry = {
    id: '1',
    entry_number: 1,
    entry_date: '2026-07-22',
    order_id: 'o1',
    order_name: 'Test',
    order_number: null,
    weather: 'Slunečno',
    weather_type: 'slunecno',
    temperature_celsius: 20,
    site_location: 'Praha',
    worker_count: 2,
    worker_names: 'A B',
    equipment: '',
    material: '',
    performances_summary: '',
    rough_work_description: '',
    work_description: 'Práce',
    ai_work_description: '',
    ai_assisted: false,
    note: '',
    extraordinary_events: '',
    entry_status: 'draft',
    created_by: 'user-1',
    created_at: '2026-07-22T00:00:00Z',
    updated_at: '2026-07-22T00:00:00Z',
  }

  it('umožní upravit vlastní draft a returned', () => {
    expect(canStavbyvedouciEditDiary(base, 'user-1')).toBe(true)
    expect(canStavbyvedouciEditDiary({ ...base, entry_status: 'returned' }, 'user-1')).toBe(true)
  })

  it('nepovolí upravit schválené, zamítnuté ani cizí', () => {
    expect(canStavbyvedouciEditDiary({ ...base, entry_status: 'approved' }, 'user-1')).toBe(false)
    expect(canStavbyvedouciEditDiary({ ...base, entry_status: 'rejected' }, 'user-1')).toBe(false)
    expect(canStavbyvedouciEditDiary(base, 'user-2')).toBe(false)
  })
})
