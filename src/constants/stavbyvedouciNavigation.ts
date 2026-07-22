import type { ModuleId, NavItem } from '@/types'

/** Povolené routy pro roli Stavbyvedoucí (Fáze 1h). */
export const STAVBYVEDOUCi_ROUTE_PREFIXES = [
  '/stavbyvedouci',
  '/zakazky-mapa',
  '/zakazky/',
  '/nastaveni/profil',
] as const

export const STAVBYVEDOUCi_FORBIDDEN_ROUTE_PREFIXES = [
  '/',
  '/delnici',
  '/vykazy',
  '/ekonomika',
  '/statistiky',
  '/nastaveni',
  '/gps-fotoarchiv',
  '/mapa-vykopu',
  '/paragony',
  '/pripojky',
  '/dokumenty',
  '/denni-formulare',
  '/vyplatni-pasky',
  '/kontrola-formulare',
  '/fakturace',
  '/administrace',
  '/zaloha',
  '/zamestnanci',
  '/dashboard',
  '/dochazka',
  '/denik',
] as const

export const STAVBYVEDOUCi_NAV: NavItem[] = [
  {
    id: 'stavbyvedouci',
    label: 'Pracovní přehled',
    path: '/stavbyvedouci',
    icon: 'LayoutDashboard',
    module: 'stavbyvedouci',
  },
  {
    id: 'stavbyvedouci-dochazka',
    label: 'Zapsat docházku',
    path: '/stavbyvedouci/dochazka',
    icon: 'Clock',
    module: 'stavbyvedouci',
  },
  {
    id: 'stavbyvedouci-naklad',
    label: 'Zapsat náklad',
    path: '/stavbyvedouci/naklad',
    icon: 'Landmark',
    module: 'stavbyvedouci',
  },
  {
    id: 'stavbyvedouci-denik',
    label: 'Stavební deník',
    path: '/stavbyvedouci/denik',
    icon: 'BookOpen',
    module: 'stavbyvedouci',
  },
  {
    id: 'stavbyvedouci-zakazky',
    label: 'Moje zakázky',
    path: '/stavbyvedouci/zakazky',
    icon: 'ClipboardList',
    module: 'stavbyvedouci',
  },
  {
    id: 'zakazky-mapa',
    label: 'Mapa zakázek',
    path: '/zakazky-mapa',
    icon: 'MapPin',
    module: 'zakazky-mapa',
  },
  {
    id: 'nastaveni-profil',
    label: 'Můj profil',
    path: '/nastaveni/profil',
    icon: 'UserCircle',
    module: 'nastaveni-profil',
  },
]

export const STAVBYVEDOUCi_RECORD_STATUS_SECTIONS = [
  { key: 'draft', label: 'Rozepsané' },
  { key: 'submitted', label: 'Čeká na kontrolu' },
  { key: 'pending_review', label: 'Čeká na kontrolu' },
  { key: 'returned', label: 'Vrácené k opravě' },
  { key: 'approved', label: 'Schválené' },
  { key: 'rejected', label: 'Zamítnuté' },
] as const

export const STAVBYVEDOUCi_ALLOWED_MODULES: ModuleId[] = [
  'stavbyvedouci',
  'zakazky',
  'zakazky-mapa',
  'nastaveni-profil',
]
