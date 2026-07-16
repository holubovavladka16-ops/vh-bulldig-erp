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

export function getSupabaseConfigHint(): string {
  if (import.meta.env.PROD) {
    return 'Nastavte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY v .env.production nebo ve Vercel → Environment Variables a spusťte nový deploy.'
  }
  return 'Vyplňte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY v souboru .env.local (viz .env.example) a restartujte vývojový server.'
}

export function getInitialAdminEmailHint(): string {
  return import.meta.env.VITE_INITIAL_ADMIN_EMAIL?.trim() ?? ''
}

const PUBLIC_URL_BAD_MARKERS = [
  'replace-with',
  'replace_with',
  'your-vercel-domain',
  'your-deployed-domain',
  'vas-projekt',
  'example.com',
  'placeholder',
  'xxx',
  'todo',
]

function looksLikeRealPublicUrl(value: string): boolean {
  if (!/^https:\/\/.+/i.test(value)) return false
  const lower = value.toLowerCase()
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false
  return !PUBLIC_URL_BAD_MARKERS.some((marker) => lower.includes(marker))
}

/**
 * Public, HTTPS base URL of the deployed app (e.g. https://vh-bulldig-erp.vercel.app).
 * Used to build links that are sent to other people/devices (worker portal links, e-mail
 * invitations, password-reset redirects) — these must NEVER resolve to `localhost` or to a
 * leftover placeholder value (e.g. "REPLACE-WITH-YOUR-VERCEL-DOMAIN.vercel.app", which was once
 * shipped as a placeholder in .env.production and — if never replaced — produced real, broken
 * shared links pointing at a URL that was never a real deployment - a confirmed past bug).
 *
 * VITE_PUBLIC_APP_URL is only used when it passes a real-looking-URL check. Otherwise this
 * always falls back to `window.location.origin`, which is correct in every realistic case: in
 * production the app is served from the real public domain, so the browser's own origin already
 * is the right answer; the env var only matters if you attach a custom domain that differs from
 * where the share action happens to run.
 */
export function getPublicAppUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  if (configured && looksLikeRealPublicUrl(configured)) {
    return configured.replace(/\/+$/, '')
  }
  if (configured && import.meta.env.PROD) {
    console.warn(
      `VITE_PUBLIC_APP_URL ("${configured}") vypadá jako neplatná nebo zástupná hodnota – ` +
        'používám aktuální doménu prohlížeče (window.location.origin) místo ní.'
    )
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}
