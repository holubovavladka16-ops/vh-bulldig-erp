import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { fetchGpsPhotoBlob } from '@/lib/photos/api'
import type { GpsPhoto } from '@/types/photos'

const MAX_WIDTH = 1080
const PANEL_PADDING_X = 28
const PANEL_PADDING_Y = 24
const LINE_HEIGHT = 34
const FONT = '600 22px system-ui, -apple-system, "Segoe UI", sans-serif'
const FONT_MONO = '500 20px ui-monospace, "Cascadia Code", monospace'
const FONT_SMALL = '500 18px system-ui, -apple-system, "Segoe UI", sans-serif'

interface PanelRow {
  text: string
  font?: string
  color?: string
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Načtení fotografie pro sdílení se nezdařilo.'))
    img.src = url
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function buildPanelRows(photo: GpsPhoto): PanelRow[] {
  const address = formatPhotoAddress(photo)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const orderName = getOrderDisplayName(photo)
  const author = photo.creator_name?.trim() || photo.worker_name?.trim() || null

  const rows: PanelRow[] = [
    { text: `📍 ${address}` },
    { text: `🌍 ${coords}`, font: FONT_MONO },
    { text: `🕒 ${dateLabel}, ${timeLabel}` },
    { text: `🏗️ Zakázka: ${orderName}` },
  ]

  if (photo.gps_accuracy != null) {
    rows.push({
      text: `📡 Přesnost GPS: ±${photo.gps_accuracy < 10 ? photo.gps_accuracy.toFixed(1) : Math.round(photo.gps_accuracy)} m`,
      font: FONT_MONO,
    })
  }

  if (author) {
    rows.push({ text: `👤 Vyfotil: ${author}` })
  }

  rows.push({
    text: '🔗 Otevřít v Google Maps',
    color: '#67e8f9',
    font: FONT_SMALL,
  })

  return rows
}

function expandRows(
  ctx: CanvasRenderingContext2D,
  rows: PanelRow[],
  contentWidth: number
): Array<PanelRow & { yOffset: number }> {
  const expanded: Array<PanelRow & { yOffset: number }> = []
  let index = 0

  for (const row of rows) {
    const font = row.font ?? FONT
    const wrapped = wrapText(ctx, row.text, contentWidth, font)
    for (const line of wrapped) {
      expanded.push({ ...row, text: line, font, yOffset: index })
      index += 1
    }
  }

  return expanded
}

export function buildGpsPhotoShareFileName(photo: GpsPhoto): string {
  const stamp = `${photo.captured_date}-${photo.captured_time.slice(0, 5).replace(':', '')}`
  return `gps-fotodoklad-${stamp}.jpg`
}

/** Vytvoří JPG/PNG s fotografií nahoře a informačním panelem dole (metadata v obraze). */
export async function buildGpsPhotoShareImageBlob(photo: GpsPhoto): Promise<Blob> {
  const blob = await fetchGpsPhotoBlob(photo.file_path)
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await loadImageFromUrl(objectUrl)
    const scale = Math.min(1, MAX_WIDTH / img.width)
    const photoW = Math.max(1, Math.round(img.width * scale))
    const photoH = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas není v prohlížeči dostupný.')

    const contentWidth = photoW - PANEL_PADDING_X * 2
    const panelRows = buildPanelRows(photo)
    const expandedRows = expandRows(ctx, panelRows, contentWidth)
    const panelH = PANEL_PADDING_Y * 2 + expandedRows.length * LINE_HEIGHT + 8

    canvas.width = photoW
    canvas.height = photoH + panelH

    ctx.drawImage(img, 0, 0, photoW, photoH)

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, photoH, photoW, panelH)

    ctx.strokeStyle = '#06b6d4'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, photoH)
    ctx.lineTo(photoW, photoH)
    ctx.stroke()

    let y = photoH + PANEL_PADDING_Y + 22
    for (const row of expandedRows) {
      ctx.font = row.font ?? FONT
      ctx.fillStyle = row.color ?? '#f8fafc'
      ctx.fillText(row.text, PANEL_PADDING_X, y)
      y += LINE_HEIGHT
    }

    ctx.font = '500 14px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
    ctx.fillText('VH Bulldig · GPS fotodokumentace', PANEL_PADDING_X, photoH + panelH - 10)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('Export fotodokladu se nezdařil.'))
        },
        'image/jpeg',
        0.9
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function buildGpsPhotoShareImageFile(photo: GpsPhoto): Promise<File> {
  const blob = await buildGpsPhotoShareImageBlob(photo)
  const fileName = buildGpsPhotoShareFileName(photo)
  return new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() })
}

export async function buildGpsPhotoSharePreviewUrl(photo: GpsPhoto): Promise<string> {
  const blob = await buildGpsPhotoShareImageBlob(photo)
  return URL.createObjectURL(blob)
}
