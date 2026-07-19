import { jsPDF } from 'jspdf'
import { ensurePdfFonts } from '@/lib/print/pdfFont'
import { getStaticMapImageUrl } from '@/lib/photos/mapLinks'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { getTypFotografieLabel } from '@/constants/fotodokumentace'
import type { FotoDokument } from '@/types/fotodokumentace'
import type { CompanySettings } from '@/types'

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function formatDatumCas(foto: FotoDokument): string {
  const d = new Date(foto.captured_at)
  return d.toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })
}

/** 1 fotografie = 1 A4 stránka – pevný formát bez stránkování 1/2, 1/3 */
async function renderFotoStranka(
  doc: jsPDF,
  foto: FotoDokument,
  company: CompanySettings | null,
  pageIndex: number
): Promise<void> {
  if (pageIndex > 0) doc.addPage()

  const margin = 12
  const pageW = 210
  const pageH = 297
  let y = margin

  doc.setFontSize(14)
  doc.text('Fotodokumentace s GPS', margin, y)
  y += 6

  doc.setFontSize(9)
  if (company?.company_name) {
    doc.text(company.company_name, margin, y)
    y += 4
  }
  if (company?.address) {
    doc.text(`${company.address}, ${company.postal_code} ${company.city}`, margin, y)
    y += 4
  }

  y += 2
  doc.setDrawColor(200)
  doc.line(margin, y, pageW - margin, y)
  y += 5

  doc.setFontSize(11)
  doc.text(`Zakázka: ${foto.order_name ?? '—'}`, margin, y)
  y += 5
  doc.setFontSize(9)
  doc.text(`Datum a čas: ${formatDatumCas(foto)}`, margin, y)
  y += 4
  doc.text(`Typ: ${getTypFotografieLabel(foto.photo_type)}`, margin, y)
  y += 4
  doc.text(`Autor: ${foto.creator_name ?? foto.worker_name ?? '—'}`, margin, y)
  y += 4
  doc.text(`Adresa: ${foto.address_full || '—'}`, margin, y)
  y += 4

  if (foto.gps_lat != null && foto.gps_lng != null) {
    doc.text(
      `GPS: ${foto.gps_lat.toFixed(6)}, ${foto.gps_lng.toFixed(6)}` +
        (foto.gps_accuracy ? ` (±${Math.round(foto.gps_accuracy)} m)` : ''),
      margin,
      y
    )
    y += 4
  }

  if (foto.note?.trim()) {
    const noteLines = doc.splitTextToSize(`Poznámka: ${foto.note.trim()}`, pageW - margin * 2)
    doc.text(noteLines, margin, y)
    y += noteLines.length * 4 + 2
  }

  const imgTop = y + 2
  const imgMaxH = 130
  const imgW = pageW - margin * 2

  const photoUrl = getFotoUrl(foto.watermarked_file_path ?? foto.file_path)
  const imgData = await loadImageDataUrl(photoUrl)

  if (imgData) {
    doc.addImage(imgData, 'JPEG', margin, imgTop, imgW, imgMaxH, undefined, 'FAST')
    y = imgTop + imgMaxH + 4
  } else {
    doc.text('Fotografie se nepodařilo načíst.', margin, imgTop + 10)
    y = imgTop + 20
  }

  if (foto.gps_lat != null && foto.gps_lng != null) {
    const mapUrl = getStaticMapImageUrl(foto.gps_lat, foto.gps_lng, 640, 120)
    const mapData = await loadImageDataUrl(mapUrl)
    const mapH = 28
    if (mapData && y + mapH < pageH - 20) {
      doc.setFontSize(8)
      doc.text('Mapa polohy:', margin, y + 3)
      doc.addImage(mapData, 'PNG', margin, y + 5, imgW, mapH)
      y += mapH + 8
    }
  }

  doc.setFontSize(8)
  doc.text(
    `Vygenerováno: ${new Date().toLocaleString('cs-CZ')} · VH Bulldig ERP`,
    margin,
    pageH - 10
  )
}

export async function vytvoritFotodokumentPdf(
  fotografie: FotoDokument[],
  company: CompanySettings | null
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  await ensurePdfFonts(doc)

  const approved = fotografie.filter((f) => f.approval_status === 'schvalena' || fotografie.length === 1)
  const toRender = approved.length > 0 ? approved : fotografie

  for (let i = 0; i < toRender.length; i++) {
    await renderFotoStranka(doc, toRender[i], company, i)
  }

  return doc.output('blob')
}

export async function vytvoritPredPoPdf(
  pred: FotoDokument,
  po: FotoDokument,
  company: CompanySettings | null
): Promise<Blob> {
  return vytvoritFotodokumentPdf([pred, po], company)
}
