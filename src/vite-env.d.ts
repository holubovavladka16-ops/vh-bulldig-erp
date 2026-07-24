/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_ID__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_INITIAL_ADMIN_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
