import type { UserRole, ModuleId } from '@/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrátor',
  vedouci: 'Vedoucí',
  delnik: 'Dělník',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  administrator: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  vedouci: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  delnik: 'bg-green-500/15 text-green-300 border border-green-500/30',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrator: 'Plný přístup do neveřejného ERP systému',
  vedouci: 'Bez přístupu do ERP – používá se pouze pro interní evidenci',
  delnik: 'Bez přístupu do ERP – zaměstnanec používá pouze osobní odkaz',
}

/** ERP je neveřejný – všechny moduly pouze pro administrátora */
export const MODULE_PERMISSIONS: Record<ModuleId, UserRole[]> = {
  dashboard: ['administrator'],
  delnici: ['administrator'],
  dochazka: ['administrator'],
  'denni-formulare': ['administrator'],
  zakazky: ['administrator'],
  vykazy: ['administrator'],
  'vyplatni-pasky': ['administrator'],
  denik: ['administrator'],
  ekonomika: ['administrator'],
  paragony: ['administrator'],
  pripojky: ['administrator'],
  fotky: ['administrator'],
  dokumenty: ['administrator'],
  statistiky: ['administrator'],
  nastaveni: ['administrator'],
  'nastaveni-spolecnost': ['administrator'],
  'nastaveni-profil': ['administrator'],
  'nastaveni-opravneni': ['administrator'],
  'nastaveni-aplikace': ['administrator'],
}

export function hasModuleAccess(role: UserRole, module: ModuleId): boolean {
  return MODULE_PERMISSIONS[module].includes(role)
}

export function isAdministrator(role: UserRole): boolean {
  return role === 'administrator'
}

export function canAccessErp(role: UserRole | undefined | null): boolean {
  return role === 'administrator'
}
