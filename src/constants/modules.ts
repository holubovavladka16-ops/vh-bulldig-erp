import type { NavItem } from '@/types'

export const APP_INFO = {
  name: 'VH Bulldig ERP',
  companyName: 'VH Bulldig s.r.o.',
  shortName: 'VH Bulldig',
  tagline: 'Stavební a zemní práce',
  version: '1.0.0',
  moduleLabel: 'VH Bulldig ERP – produkční verze',
}

export const MAIN_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Přehled',
    path: '/',
    icon: 'LayoutDashboard',
    module: 'dashboard',
  },
]

export const FUTURE_MODULES: NavItem[] = [
  { id: 'delnici', label: 'Dělníci', path: '/delnici', icon: 'HardHat', module: 'delnici' },
  { id: 'dochazka', label: 'Docházka', path: '/dochazka', icon: 'Clock', module: 'dochazka' },
  { id: 'denni-formulare', label: 'Denní formuláře', path: '/denni-formulare', icon: 'ClipboardPen', module: 'denni-formulare' },
  { id: 'zakazky', label: 'Zakázky', path: '/zakazky', icon: 'ClipboardList', module: 'zakazky' },
  { id: 'vykazy', label: 'Výkazy', path: '/vykazy', icon: 'FileSpreadsheet', module: 'vykazy' },
  { id: 'vyplatni-pasky', label: 'Výplatní pásky', path: '/vyplatni-pasky', icon: 'Wallet', module: 'vyplatni-pasky' },
  { id: 'denik', label: 'Stavební deník', path: '/denik', icon: 'BookOpen', module: 'denik' },
  { id: 'ekonomika', label: 'Náklady', path: '/ekonomika', icon: 'Landmark', module: 'ekonomika' },
  { id: 'paragony', label: 'Paragony', path: '/paragony', icon: 'Receipt', module: 'paragony' },
  { id: 'pripojky', label: 'Přípojky', path: '/pripojky', icon: 'Cable', module: 'pripojky' },
  { id: 'fotky', label: 'Mapa fotek GPS', path: '/fotky', icon: 'Camera', module: 'fotky' },
  { id: 'dokumenty', label: 'Dokumenty', path: '/dokumenty', icon: 'FileText', module: 'dokumenty' },
  { id: 'statistiky', label: 'Přehled hospodaření a zisku', path: '/statistiky', icon: 'BarChart3', module: 'statistiky' },
  { id: 'nastaveni', label: 'Nastavení', path: '/nastaveni', icon: 'Settings', module: 'nastaveni' },
]

export const ALL_NAV_ITEMS: NavItem[] = [...MAIN_NAV, ...FUTURE_MODULES]
