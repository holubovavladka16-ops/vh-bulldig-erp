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

async function fetchFotoBlob(foto: FotoDokument): Promise<{ blob: Blob; fileName: string }> {
  const url = getFotoUrl(foto.file_path)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Fotografii se nepodařilo načíst.')
  const blob = await res.blob()
  return { blob, fileName: foto.file_name || 'fotografie.jpg' }
}

export async function sdiletFotografii(foto: FotoDokument): Promise<boolean> {
  const text = formatShareText(foto)

  try {
    const { blob, fileName } = await fetchFotoBlob(foto)
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })

    if (navigator.share) {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: foto.order_name ?? 'Fotodokumentace',
          text,
        })
        return true
      }
      await navigator.share({ title: foto.order_name ?? 'Fotodokumentace', text })
      return true
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return false
  }

  try {
    const { blob, fileName } = await fetchFotoBlob(foto)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName
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

export function kopirovatOdkaz(foto: FotoDokument): Promise<void> {
  return navigator.clipboard.writeText(getFotoUrl(foto.file_path))
}
