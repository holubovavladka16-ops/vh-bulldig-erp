/** Výchozí logo VH Bulldig – vždy dostupné z /public (nezávislé na nastavení firmy). */
export const DEFAULT_APP_LOGO_URL = '/logo-bulldig.png'

export const APP_BUILD_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

export const APP_BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

export const APP_BUILD_TIME =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()

/** Pro ověření nasazeného buildu v patičce (např. v1.8.0 · a1b2c3d). */
export const APP_BUILD_LABEL = `v${APP_BUILD_VERSION} · ${APP_BUILD_ID}`

export const APP_BUILD_STORAGE_KEY = 'vh-bulldig-app-build'

export function getCurrentBuildFingerprint(): string {
  return `${APP_BUILD_VERSION}+${APP_BUILD_ID}`
}
