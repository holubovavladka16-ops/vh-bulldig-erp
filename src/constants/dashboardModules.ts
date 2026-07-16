import type { ModuleId } from '@/types'

export interface DashboardModuleItem {
  number: number
  label: string
  path: string
  icon: string
  module: ModuleId
}

/** 17 modulů přehledové obrazovky Design 2 – mapování na existující routy. */
export const DESIGN2_DASHBOARD_MODULES: DashboardModuleItem[] = [
  {
    number: 1,
    label: 'Přihlášení uživatele',
    path: '/nastaveni/opravneni',
    icon: 'LogIn',
    module: 'nastaveni-opravneni',
  },
  {
    number: 2,
    label: 'Dashboard',
    path: '/',
    icon: 'LayoutDashboard',
    module: 'dashboard',
  },
  {
    number: 3,
    label: 'Firemní údaje',
    path: '/nastaveni/spolecnost',
    icon: 'Building2',
    module: 'nastaveni-spolecnost',
  },
  {
    number: 4,
    label: 'Zaměstnanci a karta dělníka',
    path: '/delnici',
    icon: 'HardHat',
    module: 'delnici',
  },
  {
    number: 5,
    label: 'Individuální ceník zaměstnance',
    path: '/delnici',
    icon: 'Tags',
    module: 'delnici',
  },
  {
    number: 6,
    label: 'Zakázky',
    path: '/zakazky',
    icon: 'ClipboardList',
    module: 'zakazky',
  },
  {
    number: 7,
    label: 'Docházka',
    path: '/dochazka',
    icon: 'Clock',
    module: 'dochazka',
  },
  {
    number: 8,
    label: 'Výkazy',
    path: '/vykazy',
    icon: 'FileSpreadsheet',
    module: 'vykazy',
  },
  {
    number: 9,
    label: 'Náklady',
    path: '/ekonomika',
    icon: 'Landmark',
    module: 'ekonomika',
  },
  {
    number: 10,
    label: 'Fakturace a přehled zisku',
    path: '/statistiky',
    icon: 'BarChart3',
    module: 'statistiky',
  },
  {
    number: 11,
    label: 'Stavební deník',
    path: '/denik',
    icon: 'BookOpen',
    module: 'denik',
  },
  {
    number: 12,
    label: 'Přípojky',
    path: '/pripojky',
    icon: 'Cable',
    module: 'pripojky',
  },
  {
    number: 13,
    label: 'Fotodokumentace s GPS',
    path: '/fotky',
    icon: 'Camera',
    module: 'fotky',
  },
  {
    number: 14,
    label: 'Mapa a body s fotografiemi',
    path: '/fotky-na-mape',
    icon: 'MapPin',
    module: 'fotky-na-mape',
  },
  {
    number: 15,
    label: 'PDF dokumenty a výplatní pásky',
    path: '/vyplatni-pasky',
    icon: 'FileText',
    module: 'vyplatni-pasky',
  },
  {
    number: 16,
    label: 'Nastavení aplikace',
    path: '/nastaveni/aplikace',
    icon: 'SlidersHorizontal',
    module: 'nastaveni-aplikace',
  },
  {
    number: 17,
    label: 'Záloha a obnova databáze',
    path: '/nastaveni',
    icon: 'Database',
    module: 'nastaveni',
  },
]
