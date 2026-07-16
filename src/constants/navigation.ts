import type { SettingsNavItem } from '@/types'
import { APP_INFO, MAIN_NAV, FUTURE_MODULES, ALL_NAV_ITEMS } from '@/constants/modules'

export { APP_INFO, MAIN_NAV, FUTURE_MODULES, ALL_NAV_ITEMS }

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'nastaveni-spolecnost',
    label: 'Nastavení společnosti',
    path: '/nastaveni/spolecnost',
    icon: 'Building2',
    module: 'nastaveni-spolecnost',
    adminOnly: true,
  },
  {
    id: 'nastaveni-profil',
    label: 'Profil administrátora',
    path: '/nastaveni/profil',
    icon: 'UserCircle',
    module: 'nastaveni-profil',
  },
  {
    id: 'nastaveni-opravneni',
    label: 'Role uživatelů',
    path: '/nastaveni/opravneni',
    icon: 'Shield',
    module: 'nastaveni-opravneni',
    adminOnly: true,
  },
  {
    id: 'nastaveni-aplikace',
    label: 'Nastavení aplikace',
    path: '/nastaveni/aplikace',
    icon: 'SlidersHorizontal',
    module: 'nastaveni-aplikace',
  },
  {
    id: 'nastaveni-vzhled',
    label: 'Vzhled aplikace',
    path: '/nastaveni/vzhled',
    icon: 'Palette',
    module: 'nastaveni-vzhled',
    adminOnly: true,
  },
  {
    id: 'nastaveni-vodoznak-pdf',
    label: 'Vodoznak PDF',
    path: '/nastaveni/vodoznak-pdf',
    icon: 'Droplets',
    module: 'nastaveni-vodoznak-pdf',
    adminOnly: true,
  },
]
