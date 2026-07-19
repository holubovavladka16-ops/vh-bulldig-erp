import type { CompanySettings } from '@/types'
import type { FotoDokument } from '@/types/fotodokumentace'

interface WatermarkInput {
  file: File
  company: CompanySettings | null
  foto: Pick<FotoDokument, 'captured_at' | 'gps_lat' | 'gps_lng' | 'address_full' | 'order_name' | 'creator_name'>
}

export async function vytvoritVodotisk(input: WatermarkInput): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(input.file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const barH = Math.max(48, Math.round(canvas.height * 0.08))
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH)

    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.max(12, Math.round(barH * 0.22))}px sans-serif`

    const date = new Date(input.foto.captured_at).toLocaleString('cs-CZ')
    const gps =
      input.foto.gps_lat != null && input.foto.gps_lng != null
        ? `GPS: ${input.foto.gps_lat.toFixed(5)}, ${input.foto.gps_lng.toFixed(5)}`
        : ''
    const line1 = [input.company?.company_name, input.foto.order_name].filter(Boolean).join(' · ')
    const line2 = [date, input.foto.address_full, gps, input.foto.creator_name].filter(Boolean).join(' · ')

    ctx.fillText(line1.slice(0, 80), 12, canvas.height - barH + barH * 0.4)
    ctx.fillText(line2.slice(0, 120), 12, canvas.height - barH + barH * 0.75)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    )
    if (!blob) return null
    return new File([blob], `wm_${input.file.name}`, { type: 'image/jpeg' })
  } catch {
    return null
  }
}
