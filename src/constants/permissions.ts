import type { UserRole, ModuleId } from '@/types'
import {
  STAVBYVEDOUCi_ALLOWED_MODULES,
  STAVBYVEDOUCi_FORBIDDEN_ROUTE_PREFIXES,
  STAVBYVEDOUCi_ROUTE_PREFIXES,
} from '@/constants/stavbyvedouciNavigation'

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
  majitel: 'Vlastník firmy – nejvyšší oprávnění, plný přístup ke všem modulům',
  stavbyvedouci: 'Správa přidělených zakázek – deník a docházka',
  ucetni: 'Účetní – bez oprávnění měnit stav špendlíků',
  vedouci: 'Bez přístupu do ERP – používá se pouze pro interní evidenci',
  delnik: 'Bez přístupu do ERP – zaměstnanec používá pouze osobní odkaz',
}

/** ERP – Majitel má přístup ke všem modulům. Role Administrátor bude omezena v samostatném kroku. */
export const MODULE_PERMISSIONS: Record<ModuleId, UserRole[]> = {
  dashboard: ['administrator', 'majitel'],
  delnici: ['administrator', 'majitel'],
  dochazka: ['administrator', 'majitel'],
  'denni-formulare': ['administrator', 'majitel'],
  zakazky: ['administrator', 'majitel', 'stavbyvedouci'],
  'zakazky-mapa': ['administrator', 'majitel', 'stavbyvedouci'],
  vykazy: ['administrator', 'majitel'],
  'papierove-vykazy': ['administrator', 'majitel'],
  'kontrola-formulare': ['administrator', 'majitel'],
  'vyplatni-pasky': ['administrator', 'majitel'],
  denik: ['administrator', 'majitel'],
  ekonomika: ['administrator', 'majitel'],
  paragony: ['administrator', 'majitel'],
  fakturovac: ['administrator', 'majitel'],
  pripojky: ['administrator', 'majitel'],
  'gps-fotoarchiv': ['administrator', 'majitel'],
  'mapa-vykopu': ['administrator', 'majitel'],
  'denni-kalendar': ['administrator', 'majitel'],
  'fakturacni-vykaz': ['administrator', 'majitel'],
  dokumenty: ['administrator', 'majitel'],
  statistiky: ['administrator', 'majitel'],
  nastaveni: ['administrator', 'majitel'],
  'nastaveni-spolecnost': ['administrator', 'majitel'],
  'nastaveni-profil': ['administrator', 'majitel', 'stavbyvedouci'],
  'nastaveni-opravneni': ['administrator', 'majitel'],
  'nastaveni-aplikace': ['administrator', 'majitel'],
  'nastaveni-faktury': ['administrator', 'majitel'],
  stavbyvedouci: ['stavbyvedouci'],
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

/** Schvalování / zamítnutí zápisu deníku – Admin nebo Majitel. */
export function canApproveDiaryEntry(role: UserRole): boolean {
  return isAdministrator(role) || isMajitel(role)
}

/** Ruční změna barvy špendlíku – pouze Admin nebo Majitel (PDF 8 Fáze 1f). */
export function canEditMarkerColor(role: UserRole): boolean {
  return isAdministrator(role) || isMajitel(role)
}

/** Správa přiřazení Stavbyvedoucích – Admin nebo Majitel (PDF 8 Fáze 1g). */
export function canManageProjectAssignments(role: UserRole): boolean {
  return isAdministrator(role) || isMajitel(role)
}

const STAVBYVEDOUCi_MODULES: ModuleId[] = STAVBYVEDOUCi_ALLOWED_MODULES

/** Moduly dostupné rolí Stavbyvedoucí (Fáze 1g–1h). */
export function isStavbyvedouciModule(module: ModuleId): boolean {
  return STAVBYVEDOUCi_MODULES.includes(module)
}

/** Výchozí cílová stránka po přihlášení podle role. */
export function getDefaultErpPath(role: UserRole): string {
  if (role === 'stavbyvedouci') return '/stavbyvedouci'
  return '/'
}

/** Je cesta povolená pro Stavbyvedoucího? */
export function isStavbyvedouciRouteAllowed(pathname: string): boolean {
  if (pathname === '/prihlaseni') return true
  return STAVBYVEDOUCi_ROUTE_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix)
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

/** Má být Stavbyvedoucí z nepovolené URL přesměrován? */
export function shouldRedirectStavbyvedouci(pathname: string): boolean {
  if (pathname === '/prihlaseni') return false
  if (isStavbyvedouciRouteAllowed(pathname)) return false
  if (pathname === '/' || pathname === '/zakazky') return true
  return STAVBYVEDOUCi_FORBIDDEN_ROUTE_PREFIXES.some((prefix) => {
    if (prefix === '/') return pathname === '/'
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

export function canAccessErp(role: UserRole | undefined | null): boolean {
  return (
    role === 'administrator' ||
    role === 'majitel' ||
    role === 'stavbyvedouci'
  )
}
