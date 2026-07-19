import type { FotoDokument } from '@/types/fotodokumentace'
import { getFotoUrl } from '@/lib/fotodokumentace/api'

function formatShareText(foto: FotoDokument): string {
  const lines = [
    `Zakázka: ${foto.order_name ?? '—'}`,
    `Datum: ${new Date(foto.captured_at).toLocaleString('cs-CZ')}`,
    `Adresa: ${foto.address_full || '—'}`,
  ]
  if (foto.gps_lat != null && foto.gps_lng != null) {
    lines.push(`GPS: ${foto.gps_lat.toFixed(6)}, ${foto.gps_lng.toFixed(6)}`)
  }
  if (foto.note?.trim()) lines.push(`Poznámka: ${foto.note.trim()}`)
  if (foto.creator_name) lines.push(`Autor: ${foto.creator_name}`)
  return lines.join('\n')
}

export async function sdiletFotografii(foto: FotoDokument): Promise<boolean> {
  const url = getFotoUrl(foto.file_path)
  const text = formatShareText(foto)

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const file = new File([blob], foto.file_name || 'fotografie.jpg', { type: blob.type || 'image/jpeg' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: foto.order_name ?? 'Fotodokumentace', text })
      return true
    }

    if (navigator.share) {
      await navigator.share({ title: foto.order_name ?? 'Fotodokumentace', text, url })
      return true
    }
  } catch {
    // fallback below
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return true
  } catch {
    return false
  }
}

export async function stahnoutFotografii(foto: FotoDokument): Promise<void> {
  const url = getFotoUrl(foto.file_path)
  const res = await fetch(url)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = foto.file_name || 'fotografie.jpg'
  a.click()
  URL.revokeObjectURL(a.href)
}

export function kopirovatOdkaz(foto: FotoDokument): Promise<void> {
  return navigator.clipboard.writeText(getFotoUrl(foto.file_path))
}
