export type UserRole = 'administrator' | 'vedouci' | 'delnik'

export type ThemeMode = 'dark' | 'light'

export type AppDesign = 'design_1' | 'design_2' | 'design_3' | 'design_4' | 'design_5' | 'design_6'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_name: string
  ico: string
  dic: string
  address: string
  city: string
  postal_code: string
  phone: string
  email: string
  website: string
  logo_url: string
  watermark_url?: string
  watermark_opacity?: number
  watermark_size_mm?: number
  watermark_blur_px?: number
  tagline: string
  bank_account: string
  director_name: string
  accountant_email: string
  app_design: AppDesign
  updated_at: string
  updated_by: string | null
}

export interface AppSettings {
  id: string
  user_id: string
  theme: ThemeMode
  language: string
  sidebar_collapsed: boolean
  notifications_enabled: boolean
  auto_save_enabled: boolean
  compact_mode: boolean
  updated_at: string
}

export interface ErpModuleRecord {
  id: string
  label: string
  path: string
  icon: string
  sort_order: number
  is_implemented: boolean
  module_version: string
  created_at: string
}

export type ModuleId =
  | 'dashboard'
  | 'delnici'
  | 'dochazka'
  | 'denni-formulare'
  | 'zakazky'
  | 'vykazy'
  | 'papierove-vykazy'
  | 'vyplatni-pasky'
  | 'denik'
  | 'ekonomika'
  | 'paragony'
  | 'pripojky'
  | 'fotky'
  | 'fotky-na-mape'
  | 'mapa-vykopu'
  | 'dokumenty'
  | 'statistiky'
  | 'nastaveni'
  | 'nastaveni-spolecnost'
  | 'nastaveni-profil'
  | 'nastaveni-opravneni'
  | 'nastaveni-aplikace'
  | 'nastaveni-vzhled'
  | 'nastaveni-vodoznak-pdf'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: string
  module: ModuleId
}

export interface SettingsNavItem {
  id: string
  label: string
  path: string
  icon: string
  module: ModuleId
  adminOnly?: boolean
}

export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettings, 'id' | 'updated_at' | 'updated_by'> = {
  company_name: 'VH Bulldig s.r.o.',
  ico: '',
  dic: '',
  address: '',
  city: '',
  postal_code: '',
  phone: '',
  email: '',
  website: '',
  logo_url: '',
  watermark_url: '',
  watermark_opacity: 7,
  watermark_size_mm: 65,
  watermark_blur_px: 0,
  tagline: 'Stavební a zemní práce',
  bank_account: '',
  director_name: '',
  accountant_email: '',
  app_design: 'design_1',
}

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, 'id' | 'user_id' | 'updated_at'> = {
  theme: 'dark',
  language: 'cs',
  sidebar_collapsed: false,
  notifications_enabled: true,
  auto_save_enabled: true,
  compact_mode: false,
}

export interface ProfileForm {
  full_name: string
  phone: string
  email: string
}
