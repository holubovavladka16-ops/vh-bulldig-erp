/** Výchozí logo VH Bulldig – vždy dostupné z /public (nezávislé na nastavení firmy). */
export const DEFAULT_APP_LOGO_URL = '/logo-bulldig.png'

export const APP_BUILD_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
