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
import { useTheme } from '@/context/ThemeContext'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/types'
import { DEFAULT_VISUAL_THEME, isVisualThemeId } from '@/constants/visualThemes'

interface AppSettingsContextType {
  settings: AppSettings | null
  loading: boolean
  updateSettings: (partial: Partial<AppSettings>) => void
  saveSettings: (data: AppSettings) => Promise<void>
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { setTheme, setVisualTheme } = useTheme()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSettings(null)
      setLoading(false)
      return
    }

    const userId = user.id

    async function loadSettings() {
      setLoading(true)

      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Chyba načítání nastavení aplikace:', error.message)
        setLoading(false)
        return
      }

      if (data) {
        const row = data as AppSettings & { visual_theme?: string }
        const appSettings: AppSettings = {
          ...row,
          visual_theme: isVisualThemeId(row.visual_theme ?? '')
            ? row.visual_theme
            : DEFAULT_VISUAL_THEME,
        }
        setSettings(appSettings)
        setTheme(appSettings.theme)
        setVisualTheme(appSettings.visual_theme)
      } else {
        const { data: created, error: createError } = await supabase
          .from('app_settings')
          .insert({ user_id: userId, ...DEFAULT_APP_SETTINGS })
          .select('*')
          .single()

        if (!createError && created) {
          const appSettings = created as AppSettings
          setSettings(appSettings)
          setTheme(appSettings.theme)
          setVisualTheme(appSettings.visual_theme ?? DEFAULT_VISUAL_THEME)
        }
      }

      setLoading(false)
    }

    loadSettings()
  }, [user, setTheme, setVisualTheme])

  const saveSettings = useCallback(async (data: AppSettings) => {
    if (!user) return

    const { error } = await supabase
      .from('app_settings')
      .update({
        theme: data.theme,
        visual_theme: data.visual_theme,
        language: data.language,
        sidebar_collapsed: data.sidebar_collapsed,
        notifications_enabled: data.notifications_enabled,
        auto_save_enabled: data.auto_save_enabled,
        compact_mode: data.compact_mode,
      })
      .eq('user_id', user.id)

    if (error) {
      throw new Error(error.message)
    }

    if (data.theme) {
      setTheme(data.theme)
    }

    if (data.visual_theme) {
      setVisualTheme(data.visual_theme)
    }
  }, [user, setTheme, setVisualTheme])

  function updateSettings(partial: Partial<AppSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  return (
    <AppSettingsContext.Provider
      value={{ settings, loading, updateSettings, saveSettings }}
    >
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) {
    throw new Error('useAppSettings musí být použit uvnitř AppSettingsProvider')
  }
  return context
}
