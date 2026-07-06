import { supabase } from '@/lib/supabase'
import { formatSupabaseError, logSupabaseError } from '@/lib/supabaseErrors'

const LOGO_BUCKET = 'company-logos'

async function uploadCompanyImage(settingsId: string, file: File, prefix: 'logo' | 'watermark'): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${settingsId}/${prefix}_${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true })
  if (uploadError) {
    logSupabaseError(`uploadCompanyImage.${prefix}`, uploadError)
    throw new Error(formatSupabaseError(uploadError))
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadCompanyLogo(settingsId: string, file: File): Promise<string> {
  return uploadCompanyImage(settingsId, file, 'logo')
}

export async function uploadCompanyWatermark(settingsId: string, file: File): Promise<string> {
  return uploadCompanyImage(settingsId, file, 'watermark')
}
