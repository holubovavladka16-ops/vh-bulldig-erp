import type { FotoDokument } from '@/types/fotodokumentace'
import type { CompanySettings } from '@/types'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { createFotoReportPdfFile } from '@/lib/fotodokumentace/fotoReportPdf'
import { getMapyCzUrl } from '@/lib/photos/mapLinks'

function formatShareText(foto: FotoDokument): string {
  const lines = [
    `Zakázka: ${foto.order_name ?? '—'}`,
    `Datum: ${new Date(foto.captured_at).toLocaleString('cs-CZ')}`,
    `Adresa: ${foto.address_full || '—'}`,
  ]
  if (foto.gps_lat != null && foto.gps_lng != null) {
    lines.push(`GPS: ${foto.gps_lat.toFixed(6)}, ${foto.gps_lng.toFixed(6)}`)
    lines.push(`Mapa: ${getMapyCzUrl(foto.gps_lat, foto.gps_lng)}`)
  }
  if (foto.note?.trim()) lines.push(`Poznámka: ${foto.note.trim()}`)
  if (foto.creator_name) lines.push(`Autor: ${foto.creator_name}`)
  return lines.join('\n')
}

async function fetchFotoBlob(foto: FotoDokument): Promise<{ blob: Blob; fileName: string }> {
  const url = getFotoUrl(foto.file_path)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Fotografii se nepodařilo načíst.')
  const blob = await res.blob()
  return { blob, fileName: foto.file_name || 'fotografie.jpg' }
}

export function getPublicFotoUrl(fotoId: string): string {
  return `${window.location.origin}/sdileni/fotografie/${fotoId}`
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getMessengerShareUrl(text: string): string {
  const redirect = encodeURIComponent(window.location.href)
  return `https://www.facebook.com/dialog/send?app_id=0&redirect_uri=${redirect}&quote=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

export function sdiletPresWhatsApp(foto: FotoDokument): void {
  const text = `${formatShareText(foto)}\n\nOdkaz: ${getPublicFotoUrl(foto.id)}`
  window.open(getWhatsAppShareUrl(text), '_blank')
}

export function sdiletPresMessenger(foto: FotoDokument): void {
  const text = `${formatShareText(foto)}\n\nOdkaz: ${getPublicFotoUrl(foto.id)}`
  window.open(getMessengerShareUrl(text), '_blank')
}

export function sdiletPresEmail(foto: FotoDokument): void {
  const subject = `Fotodokumentace – ${foto.order_name ?? 'VH Bulldig'}`
  const text = `${formatShareText(foto)}\n\nOdkaz: ${getPublicFotoUrl(foto.id)}`
  window.location.href = getEmailShareUrl(text, subject)
}

export async function sdiletFotografii(
  foto: FotoDokument,
  company?: CompanySettings | null
): Promise<boolean> {
  const text = formatShareText(foto)

  try {
    const file = await createFotoReportPdfFile(foto, company)

    if (navigator.share) {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: foto.order_name ?? 'GPS fotodoklad',
          text,
        })
        return true
      }
      await navigator.share({ title: foto.order_name ?? 'GPS fotodoklad', text })
      return true
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return false
  }

  try {
    const file = await createFotoReportPdfFile(foto, company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    URL.revokeObjectURL(a.href)
    return true
  } catch {
    return false
  }
}

export async function stahnoutFotografii(foto: FotoDokument): Promise<void> {
  const { blob, fileName } = await fetchFotoBlob(foto)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function kopirovatOdkaz(foto: FotoDokument): Promise<void> {
  await navigator.clipboard.writeText(getPublicFotoUrl(foto.id))
}

export async function kopirovatText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
