import { supabase } from '@/lib/supabase'
import { formatSupabaseError, logSupabaseError } from '@/lib/supabaseErrors'

const LOGO_BUCKET = 'company-logos'

export async function uploadCompanyLogo(settingsId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${settingsId}/logo_${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true })
  if (uploadError) {
    logSupabaseError('uploadCompanyLogo.storage', uploadError)
    throw new Error(formatSupabaseError(uploadError))
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
