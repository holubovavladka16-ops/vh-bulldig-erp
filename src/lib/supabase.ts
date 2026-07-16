import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getSupabaseAnonKey,
  getSupabaseConfigHint,
  getSupabaseUrl,
  isSupabaseConfigured,
} from '@/lib/env'

export { isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey, getSupabaseConfigHint }

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

if (!isSupabaseConfigured()) {
  console.error(`Chybí Supabase konfigurace. ${getSupabaseConfigHint()}`)
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
)
