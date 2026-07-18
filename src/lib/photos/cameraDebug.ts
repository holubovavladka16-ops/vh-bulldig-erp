/** Diagnostika kamery: dev režim nebo ?cameraDebug=1 v URL. */
export function isCameraDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('cameraDebug') === '1'
}
