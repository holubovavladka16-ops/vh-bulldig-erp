import { jsPDF } from 'jspdf'
import {
  FORM_CHECK_OUTCOME_DESCRIPTIONS,
  FORM_CHECK_OUTCOME_LABELS,
} from '@/constants/formCheck'
import { formatDateCs } from '@/lib/formCheck/normalize'
import { ensurePdfFonts } from '@/lib/print/pdfFont'
import type { FormCheckRecordDetail } from '@/types/formCheck'

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

export async function buildFormCheckPdfBlob(
  record: FormCheckRecordDetail,
  photoUrl?: string | null
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  await ensurePdfFonts(doc)

  const margin = 14
  let y = margin

  doc.setFontSize(16)
  doc.text('Kontrola formuláře – výpis', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.text(`Datum kontroly: ${new Date(record.checkedAt).toLocaleString('cs-CZ')}`, margin, y)
  y += 5
  doc.text(`Uživatel: ${record.checkedByName ?? '—'}`, margin, y)
  y += 5
  doc.text(`Formulář: ${record.formNumber}`, margin, y)
  y += 5
  doc.text(`Zaměstnanec: ${record.workerName}`, margin, y)
  y += 5
  doc.text(`Období: ${record.periodLabel}`, margin, y)
  y += 7

  doc.setFontSize(12)
  doc.text(
    `Výsledek: ${FORM_CHECK_OUTCOME_LABELS[record.outcome]} – ${FORM_CHECK_OUTCOME_DESCRIPTIONS[record.outcome]}`,
    margin,
    y
  )
  y += 6
  doc.setFontSize(10)
  doc.text(`Počet rozdílů: ${record.differenceCount}`, margin, y)
  y += 5
  doc.text(
    `OCR confidence: ${record.ocrConfidence != null ? `${Math.round(record.ocrConfidence * 100)} %` : '—'}`,
    margin,
    y
  )
  y += 8

  if (photoUrl) {
    const dataUrl = await loadImageDataUrl(photoUrl)
    if (dataUrl) {
      doc.setFontSize(11)
      doc.text('Fotografie formuláře', margin, y)
      y += 4
      const imgW = 180
      const imgH = 100
      if (y + imgH > 270) {
        doc.addPage()
        y = margin
      }
      doc.addImage(dataUrl, 'JPEG', margin, y, imgW, imgH)
      y += imgH + 8
    }
  }

  if (y > 250) {
    doc.addPage()
    y = margin
  }

  doc.setFontSize(11)
  doc.text('Souhrn porovnání', margin, y)
  y += 5
  doc.setFontSize(9)
  doc.text(
    `Hodiny formulář: ${record.comparisonResult.formTotalHours ?? '—'} h | ERP: ${record.comparisonResult.erpTotalHours ?? '—'} h`,
    margin,
    y
  )
  y += 5
  doc.text(`Porovnaných dnů: ${record.comparisonResult.comparedDays}`, margin, y)
  y += 8

  doc.setFontSize(11)
  doc.text('Tabulka rozdílů', margin, y)
  y += 5

  const diffItems = record.comparisonResult.items.filter((i) => i.status !== 'match')
  const items = diffItems.length > 0 ? diffItems : record.comparisonResult.items.slice(0, 20)

  doc.setFontSize(8)
  for (const item of items) {
    if (y > 280) {
      doc.addPage()
      y = margin
    }
    const dateLabel = item.date === 'součet' ? 'Součet' : formatDateCs(item.date)
    const line = `${dateLabel} | ${item.fieldLabel} | ERP: ${item.erpValue} | Formulář: ${item.formValue} | ${item.status}`
    const wrapped = doc.splitTextToSize(line, 182)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4 + 1
  }

  y += 4
  if (y > 270) {
    doc.addPage()
    y = margin
  }
  doc.setFontSize(9)
  doc.text('Poznámka: Tato kontrola nemění docházku v ERP.', margin, y)

  return doc.output('blob')
}

export function getFormCheckPdfFilename(record: FormCheckRecordDetail): string {
  const date = new Date(record.checkedAt).toISOString().slice(0, 10)
  return `kontrola-formulare_${record.formNumber}_${date}.pdf`
}
