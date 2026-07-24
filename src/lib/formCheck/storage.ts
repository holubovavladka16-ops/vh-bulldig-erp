import { supabase } from '@/lib/supabase'

/**
 * Nahraje fotografii formuláře do Supabase Storage (bucket paper-forms).
 * Cesta: form-check/{formId}/scan-{timestamp}.{ext}
 */
export async function uploadFormCheckScan(formId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `form-check/${formId}/scan-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('paper-forms').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw new Error(error.message)
  return path
}
