import {
  APP_BUILD_STORAGE_KEY,
  getCurrentBuildFingerprint,
} from '@/constants/branding'

/** Po deployi načte nový bundle — obejde starou PWA / SPA cache. */
export function ensureFreshBuildLoaded(): void {
  if (typeof window === 'undefined') return

  const current = getCurrentBuildFingerprint()
  const previous = localStorage.getItem(APP_BUILD_STORAGE_KEY)

  if (previous && previous !== current) {
    localStorage.setItem(APP_BUILD_STORAGE_KEY, current)
    window.location.reload()
    return
  }

  if (!previous) {
    localStorage.setItem(APP_BUILD_STORAGE_KEY, current)
  }
}
