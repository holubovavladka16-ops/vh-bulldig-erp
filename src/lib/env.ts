const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-key'

const EXAMPLE_MARKERS = ['vas-projekt', 'vase-anon-key', 'your-project', 'your-anon-key']

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value?.trim()) return true
  const normalized = value.trim().toLowerCase()
  if (normalized === PLACEHOLDER_URL || normalized === PLACEHOLDER_KEY) return true
  return EXAMPLE_MARKERS.some((marker) => normalized.includes(marker))
}

export function getSupabaseUrl(): string | undefined {
  const value = import.meta.env.VITE_SUPABASE_URL?.trim()
  return isPlaceholderValue(value) ? undefined : value
}

export function getSupabaseAnonKey(): string | undefined {
  const value = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return isPlaceholderValue(value) ? undefined : value
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}

export function getInitialAdminEmailHint(): string {
  return import.meta.env.VITE_INITIAL_ADMIN_EMAIL?.trim() ?? ''
}
