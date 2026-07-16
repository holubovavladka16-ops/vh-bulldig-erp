import { getPortalUrl } from '@/constants/workers'

export function buildFormLinkShareMessage(firstName: string, portalUrl: string): string {
  return `Dobrý den ${firstName}, zde je váš osobní odkaz pro denní výkaz VH Bulldig: ${portalUrl}`
}

export function getFormLinkWhatsAppUrl(message: string, phone?: string | null): string {
  const encoded = encodeURIComponent(message)
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}

export function getFormLinkEmailUrl(message: string, email?: string | null): string {
  const to = email?.trim() ? encodeURIComponent(email.trim()) : ''
  return `mailto:${to}?subject=${encodeURIComponent('Odkaz na formulář – VH Bulldig')}&body=${encodeURIComponent(message)}`
}

export function getPortalShareUrl(token: string): string {
  return getPortalUrl(token)
}
