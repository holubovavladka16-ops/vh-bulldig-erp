/** Detekce mobilního prohlížeče / WebView pro PDF workflow (ne desktop). */
export function isMobilePdfDevice(): boolean {
  if (typeof window === 'undefined') return false

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrowViewport = window.matchMedia('(max-width: 900px)').matches
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|WebView|wv/i.test(navigator.userAgent)

  return mobileUa || (coarsePointer && narrowViewport)
}
