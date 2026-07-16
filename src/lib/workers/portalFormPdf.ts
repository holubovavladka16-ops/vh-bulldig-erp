import { PRICE_UNIT_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { calculateTaskLineEarnings, getTaskPriceItems } from '@/lib/workers/earnings'
import { VectorPdfDocument } from '@/lib/print/vectorPdfDocument'
import { companySettingsToHeader } from '@/lib/print/printDocument'
import { assertValidPdfBlob } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type { PortalWorker, TaskLineInput, WorkerPriceItem } from '@/types/workers'

export interface PortalFormPdfInput {
  worker: PortalWorker
  formDate: string
  orderName: string
  workStart: string
  workEnd: string
  breakMinutes: number
  workHours: number
  advance: number
  material: string
  note: string
  workDescription: string
  taskLines: TaskLineInput[]
  priceItems: WorkerPriceItem[]
  earnings: number
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
  signatureData: string | null
}

export function getPortalFormPdfFilename(worker: PortalWorker, formDate: string): string {
  const safeLast = worker.last_name.replace(/[^\w.-]+/g, '_')
  const date = formDate.replace(/-/g, '')
  return `denni_vykaz_${safeLast}_${date}.pdf`
}

export async function buildPortalFormPdfBlob(
  input: PortalFormPdfInput,
  company: CompanySettings
): Promise<Blob> {
  const header = companySettingsToHeader(company)
  const pdf = new VectorPdfDocument(header)
  await pdf.prepare()

  pdf.drawCompanyHeader({
    title: 'Denní výkaz pracovníka',
    documentNumber: `DV-${input.formDate.replace(/-/g, '')}`,
  })

  const items = getTaskPriceItems(input.priceItems)
  const activeLines = input.taskLines.filter((line) => line.quantity > 0)

  pdf.drawTwoColumnMeta([
    { label: 'Zaměstnanec', value: `${input.worker.first_name} ${input.worker.last_name}` },
    { label: 'Pozice', value: input.worker.position || '—' },
    { label: 'Datum', value: formatDate(input.formDate) },
    { label: 'Zakázka', value: input.orderName || '—' },
    { label: 'Odpracováno', value: `${input.workHours} h` },
    { label: 'Výdělek', value: formatCurrency(input.earnings) },
    { label: 'Záloha', value: formatCurrency(input.advance) },
    { label: 'K vyplacení (odhad)', value: formatCurrency(Math.max(0, input.earnings - input.advance)) },
  ])

  pdf.drawSectionTitle('Docházka')
  pdf.drawKeyValueRows([
    { label: 'Příchod', value: input.workStart ? input.workStart.slice(0, 5) : '—' },
    { label: 'Odchod', value: input.workEnd ? input.workEnd.slice(0, 5) : '—' },
    { label: 'Přestávka', value: `${input.breakMinutes} min` },
  ])

  pdf.drawSectionTitle('Výkony')
  pdf.drawTable(
    [
      { header: 'Název', widthRatio: 0.34 },
      { header: 'Množství', widthRatio: 0.14, align: 'right' },
      { header: 'Jednotka', widthRatio: 0.14 },
      { header: 'Cena', widthRatio: 0.18, align: 'right' },
      { header: 'Celkem', widthRatio: 0.2, align: 'right' },
    ],
    activeLines.length > 0
      ? activeLines.map((line) => {
          const item = items.find((p) => p.id === line.price_item_id)
          if (!item) return ['—', '—', '—', '—', '—']
          return [
            item.name,
            String(line.quantity),
            PRICE_UNIT_LABELS[item.unit_type],
            formatCurrency(item.price),
            formatCurrency(calculateTaskLineEarnings(item, line.quantity)),
          ]
        })
      : [['Žádné výkony', '—', '—', '—', '—']]
  )

  if (input.material.trim()) {
    pdf.drawSectionTitle('Materiál')
    pdf.drawParagraph(input.material)
  }

  const note = [input.workDescription, input.note].filter(Boolean).join('\n').trim()
  if (note) {
    pdf.drawSectionTitle('Poznámka')
    pdf.drawParagraph(note)
  }

  if (input.gpsLat != null && input.gpsLng != null) {
    pdf.drawKeyValueRows([
      {
        label: 'GPS',
        value: `${input.gpsLat.toFixed(5)}, ${input.gpsLng.toFixed(5)}${input.gpsAccuracy ? ` (±${Math.round(input.gpsAccuracy)} m)` : ''}`,
      },
    ])
  }

  if (input.signatureData) {
    await pdf.drawImageBlock('Podpis zaměstnance', input.signatureData, 28)
  }

  const blob = pdf.toBlob()
  await assertValidPdfBlob(blob)
  return blob
}
