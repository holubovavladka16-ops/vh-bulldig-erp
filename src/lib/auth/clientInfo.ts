/**
 * Parsování informací o klientovi pro bezpečnostní log přihlášení.
 */
export interface ClientLoginInfo {
  user_agent: string
  device: string
  browser: string
  os: string
  device_type: 'mobile' | 'desktop' | 'unknown'
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Microsoft Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Google Chrome'
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Apple Safari'
  if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer'
  return 'Neznámý prohlížeč'
}

function detectOs(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Neznámý OS'
}

function detectDevice(ua: string, deviceType: ClientLoginInfo['device_type']): string {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]+)\)/i)
    if (match?.[1]) return match[1].trim()
    return 'Android zařízení'
  }
  if (deviceType === 'desktop') return 'Počítač'
  return 'Neznámé zařízení'
}

export function parseClientLoginInfo(): ClientLoginInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)

  const device_type: ClientLoginInfo['device_type'] = ua
    ? isMobile
      ? 'mobile'
      : 'desktop'
    : 'unknown'

  return {
    user_agent: ua,
    browser: detectBrowser(ua),
    os: detectOs(ua),
    device: detectDevice(ua, device_type),
    device_type,
  }
}

export function formatDeviceTypeLabel(deviceType: ClientLoginInfo['device_type']): string {
  if (deviceType === 'mobile') return 'Mobil'
  if (deviceType === 'desktop') return 'PC'
  return 'Neznámé'
}
