import type { PostgrestError } from '@supabase/supabase-js'

export function formatSupabaseError(error: PostgrestError | Error | null | undefined): string {
  if (!error) return 'Neznámá chyba'
  if (!('code' in error) || !error.code) {
    return error.message || 'Neznámá chyba'
  }

  const parts = [error.message]
  parts.push(`[${error.code}]`)
  if ('details' in error && error.details) parts.push(String(error.details))
  if ('hint' in error && error.hint) parts.push(String(error.hint))
  return parts.join(' · ')
}

export function logSupabaseError(context: string, error: PostgrestError | Error): void {
  console.error(`[${context}]`, error)
}
