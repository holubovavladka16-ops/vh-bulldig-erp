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

import { type CompanySettings } from '@/types'



interface CompanySettingsContextType {

  settings: CompanySettings | null

  loading: boolean

  updateSettings: (partial: Partial<CompanySettings>) => void

  saveSettings: (data: CompanySettings) => Promise<void>

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

      setSettings(data as CompanySettings)

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

        tagline: data.tagline,

        bank_account: data.bank_account,

        director_name: data.director_name,

        accountant_email: data.accountant_email,

        updated_by: user.id,

      })

      .eq('id', data.id)



    if (error) {

      throw new Error(error.message)

    }

  }, [user])



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


