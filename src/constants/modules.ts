import type { NavItem } from '@/types'
import { APP_BUILD_VERSION } from '@/constants/branding'

export const APP_INFO = {
  name: 'VH Bulldig ERP',
  companyName: 'VH Bulldig s.r.o.',
  shortName: 'VH Bulldig',
  tagline: 'Stavební a zemní práce',
  version: APP_BUILD_VERSION,
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
  { id: 'papierove-vykazy', label: 'Papírové měsíční výkazy', path: '/vykazy/papierove', icon: 'FileStack', module: 'papierove-vykazy' },
  { id: 'kontrola-formulare', label: 'Kontrola formuláře', path: '/kontrola-formulare', icon: 'ScanLine', module: 'kontrola-formulare' },
  { id: 'vyplatni-pasky', label: 'Výplatní pásky', path: '/vyplatni-pasky', icon: 'Wallet', module: 'vyplatni-pasky' },
  { id: 'denik', label: 'Stavební deník', path: '/denik', icon: 'BookOpen', module: 'denik' },
  { id: 'ekonomika', label: 'Náklady', path: '/ekonomika', icon: 'Landmark', module: 'ekonomika' },
  { id: 'paragony', label: 'Paragony', path: '/paragony', icon: 'Receipt', module: 'paragony' },
  { id: 'pripojky', label: 'Přípojky', path: '/pripojky', icon: 'Cable', module: 'pripojky' },
  { id: 'mapa-vykopu', label: 'Mapa výkopů', path: '/mapa-vykopu', icon: 'Route', module: 'mapa-vykopu' },
  { id: 'fotky', label: 'Fotodokumentace GPS', path: '/fotky', icon: 'Camera', module: 'fotky' },
  { id: 'fotky-na-mape', label: 'Fotky na mapě', path: '/fotky-na-mape', icon: 'MapPin', module: 'fotky-na-mape' },
  { id: 'dokumenty', label: 'Dokumenty', path: '/dokumenty', icon: 'FileText', module: 'dokumenty' },
  { id: 'statistiky', label: 'Přehled hospodaření a zisku', path: '/statistiky', icon: 'BarChart3', module: 'statistiky' },
  { id: 'nastaveni', label: 'Nastavení', path: '/nastaveni', icon: 'Settings', module: 'nastaveni' },
]

export const ALL_NAV_ITEMS: NavItem[] = [...MAIN_NAV, ...FUTURE_MODULES]
