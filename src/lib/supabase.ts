import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/env'

export { isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey }

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

if (!isSupabaseConfigured()) {
  console.error(
    'Chybí Supabase konfigurace. Vyplňte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY v souboru .env.local (viz .env.example).'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key'
)
