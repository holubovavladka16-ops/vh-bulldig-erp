import { supabase } from '@/lib/supabase'
import { normalizeAppDesign } from '@/constants/appDesign'
import type { AppDesign } from '@/types'

export async function fetchAppDesign(): Promise<AppDesign> {
  const { data, error } = await supabase.rpc('get_app_design')

  if (error) {
    console.error('Chyba načítání vzhledu aplikace:', error.message)
    return 'design_1'
  }

  return normalizeAppDesign(data)
}

export async function saveAppDesign(
  settingsId: string,
  design: AppDesign,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('company_settings')
    .update({
      app_design: design,
      updated_by: userId,
    })
    .eq('id', settingsId)

  if (error) {
    throw new Error(error.message)
  }
}
