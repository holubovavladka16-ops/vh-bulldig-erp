import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { normalizeAppDesign } from '@/constants/appDesign'
import { saveAppDesign as persistAppDesign } from '@/lib/company/appDesign'
import { type AppDesign, type CompanySettings } from '@/types'

interface CompanySettingsContextType {
  settings: CompanySettings | null
  loading: boolean
  updateSettings: (partial: Partial<CompanySettings>) => void
  saveSettings: (data: CompanySettings) => Promise<void>
  saveCompanyDefaultAppDesign: (design: AppDesign) => Promise<void>
  refreshProfile: () => Promise<void>
}

const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined)

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Chyba načítání nastavení společnosti:', error.message)
      setLoading(false)
      return
    }

    if (data) {
      const raw = data as Record<string, unknown>
      const companySettings = {
        ...raw,
        app_design: normalizeAppDesign(raw.app_design),
        watermark_opacity: Number(raw.watermark_opacity ?? 7),
        watermark_size_mm: Number(raw.watermark_size_mm ?? 65),
        watermark_blur_px: Number(raw.watermark_blur_px ?? 0),
      } as CompanySettings
      setSettings(companySettings)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) {
      loadSettings()
    } else {
      setSettings(null)
      setLoading(false)
    }
  }, [user, loadSettings])

  const saveSettings = useCallback(async (data: CompanySettings) => {
    if (!user) return

    const { error } = await supabase
      .from('company_settings')
      .update({
        company_name: data.company_name,
        ico: data.ico,
        dic: data.dic,
        address: data.address,
        city: data.city,
        postal_code: data.postal_code,
        phone: data.phone,
        email: data.email,
        website: data.website,
        logo_url: data.logo_url,
        watermark_url: data.watermark_url ?? '',
        watermark_opacity: data.watermark_opacity ?? 7,
        watermark_size_mm: data.watermark_size_mm ?? 65,
        watermark_blur_px: data.watermark_blur_px ?? 0,
        tagline: data.tagline,
        bank_account: data.bank_account,
        director_name: data.director_name,
        accountant_email: data.accountant_email,
        app_design: normalizeAppDesign(data.app_design),
        updated_by: user.id,
      })
      .eq('id', data.id)

    if (error) {
      throw new Error(error.message)
    }

    setSettings({ ...data, updated_at: new Date().toISOString() })
  }, [user])

  const saveCompanyDefaultAppDesign = useCallback(
    async (design: AppDesign) => {
      if (!user || !settings) return

      const normalized = normalizeAppDesign(design)
      await persistAppDesign(settings.id, normalized, user.id)
      setSettings((prev) => (prev ? { ...prev, app_design: normalized } : prev))
    },
    [user, settings]
  )

  function updateSettings(partial: Partial<CompanySettings>) {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  return (
    <CompanySettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        saveSettings,
        saveCompanyDefaultAppDesign,
        refreshProfile: loadSettings,
      }}
    >
      {children}
    </CompanySettingsContext.Provider>
  )
}

export function useCompanySettings() {
  const context = useContext(CompanySettingsContext)
  if (!context) {
    throw new Error('useCompanySettings musí být použit uvnitř CompanySettingsProvider')
  }
  return context
}
