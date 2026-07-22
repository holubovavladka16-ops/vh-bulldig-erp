import type { UserRole, ModuleId } from '@/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrátor',
  majitel: 'Majitel',
  stavbyvedouci: 'Stavbyvedoucí',
  ucetni: 'Účetní',
  vedouci: 'Vedoucí',
  delnik: 'Dělník',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  administrator: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  majitel: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  stavbyvedouci: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  ucetni: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  vedouci: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  delnik: 'bg-green-500/15 text-green-300 border border-green-500/30',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrator: 'Plný přístup do neveřejného ERP systému',
  majitel: 'Vlastník firmy – správa zakázek a mapy',
  stavbyvedouci: 'Správa přidělených zakázek – deník a docházka',
  ucetni: 'Účetní – bez oprávnění měnit stav špendlíků',
  vedouci: 'Bez přístupu do ERP – používá se pouze pro interní evidenci',
  delnik: 'Bez přístupu do ERP – zaměstnanec používá pouze osobní odkaz',
}

/** ERP je neveřejný – všechny moduly pouze pro administrátora */
export const MODULE_PERMISSIONS: Record<ModuleId, UserRole[]> = {
  dashboard: ['administrator'],
  delnici: ['administrator'],
  dochazka: ['administrator'],
  'denni-formulare': ['administrator'],
  zakazky: ['administrator', 'majitel'],
  'zakazky-mapa': ['administrator', 'majitel'],
  vykazy: ['administrator'],
  'papierove-vykazy': ['administrator'],
  'kontrola-formulare': ['administrator'],
  'vyplatni-pasky': ['administrator'],
  denik: ['administrator'],
  ekonomika: ['administrator'],
  paragony: ['administrator'],
  pripojky: ['administrator'],
  'gps-fotoarchiv': ['administrator'],
  'mapa-vykopu': ['administrator'],
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

export function isMajitel(role: UserRole): boolean {
  return role === 'majitel'
}

export function isStavbyvedouci(role: UserRole): boolean {
  return role === 'stavbyvedouci'
}

export function isUcetni(role: UserRole): boolean {
  return role === 'ucetni'
}

/** Ruční změna barvy špendlíku – pouze Admin nebo Majitel (PDF 8 Fáze 1f). */
export function canEditMarkerColor(role: UserRole): boolean {
  return isAdministrator(role) || isMajitel(role)
}

export function canAccessErp(role: UserRole | undefined | null): boolean {
  return role === 'administrator' || role === 'majitel'
}
