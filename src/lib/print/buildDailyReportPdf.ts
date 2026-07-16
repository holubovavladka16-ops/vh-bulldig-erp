import { PRICE_UNIT_LABELS, WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'
import { getFormPhotoUrl } from '@/lib/workers/module5'
import { VectorPdfDocument } from '@/lib/print/vectorPdfDocument'
import { companySettingsToHeader } from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import type { ReportDetail } from '@/types/workers'

async function renderDailyReportBody(pdf: VectorPdfDocument, detail: ReportDetail): Promise<void> {
  const { report, form, worker, task_items, photos } = detail

  const metaRows: Array<{ label: string; value: string }> = [
    { label: 'Pozice', value: worker.position || '—' },
    { label: 'Datum', value: formatDate(report.report_date) },
    { label: 'Zakázka', value: report.order_name || '—' },
    { label: 'Odpracované hodiny', value: `${report.hours} h` },
    { label: 'Celkový výdělek', value: formatCurrency(report.earnings) },
    { label: 'Denní záloha', value: formatCurrency(report.advance ?? 0) },
    { label: 'Stav', value: WORKER_REPORT_STATUS_LABELS[report.status] },
    { label: 'Materiál', value: report.material || '—' },
  ]

  if (report.note?.trim()) {
    metaRows.push({ label: 'Poznámka', value: report.note })
  }

  if (form?.gps_lat != null && form.gps_lng != null) {
    metaRows.push({
      label: 'GPS poloha',
      value: `${form.gps_lat.toFixed(5)}, ${form.gps_lng.toFixed(5)}${form.gps_accuracy ? ` (±${Math.round(form.gps_accuracy)} m)` : ''}`,
    })
  }

  pdf.drawTwoColumnMeta(metaRows)

  if (form) {
    pdf.drawSectionTitle('Docházka')
    pdf.drawKeyValueRows([
      { label: 'Začátek práce', value: form.work_start ? formatTimeForInput(form.work_start) : '—' },
      { label: 'Konec práce', value: form.work_end ? formatTimeForInput(form.work_end) : '—' },
      { label: 'Přestávka', value: form.break_minutes ? `${form.break_minutes} min` : '—' },
    ])
  }

  pdf.drawSectionTitle('Vykázané práce')
  pdf.drawTable(
    [
      { header: 'Název', widthRatio: 0.34 },
      { header: 'Množství', widthRatio: 0.14, align: 'right' },
      { header: 'Jednotka', widthRatio: 0.14 },
      { header: 'Cena', widthRatio: 0.18, align: 'right' },
      { header: 'Celkem', widthRatio: 0.2, align: 'right' },
    ],
    task_items.length > 0
      ? task_items.map((item) => [
          item.name,
          String(item.quantity),
          PRICE_UNIT_LABELS[item.unit_type],
          formatCurrency(item.price),
          formatCurrency(item.line_earnings),
        ])
      : [['Žádné výkony', '—', '—', '—', '—']]
  )

  if (form?.signature_data) {
    await pdf.drawImageBlock('Podpis zaměstnance', form.signature_data, 28)
  }

  if (photos.length > 0) {
    pdf.drawSectionTitle('Fotografie')
    for (const photo of photos) {
      await pdf.drawImage(getFormPhotoUrl(photo.file_path), 55)
    }
  }

  pdf.drawParagraph(
    'Docházka slouží pouze jako evidence odpracovaného času. Výdělek se počítá výhradně z výkonů a osobního ceníku.'
  )
}

export async function buildDailyReportPdfBlob(
  detail: ReportDetail,
  company: CompanySettings
): Promise<Blob> {
  const header = companySettingsToHeader(company)
  const pdf = new VectorPdfDocument(header)
  await pdf.prepare()

  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  pdf.drawCompanyHeader({
    title: `Denní výkaz – ${workerName}`,
    documentNumber: `VYK-${detail.report.id.slice(0, 8).toUpperCase()}`,
  })

  await renderDailyReportBody(pdf, detail)
  return pdf.toBlob()
}

export async function buildBulkReportsPdfBlob(
  details: ReportDetail[],
  company: CompanySettings
): Promise<Blob> {
  if (details.length === 0) throw new Error('Žádné výkazy k exportu.')

  const sorted = [...details].sort((a, b) =>
    String(a.report.report_date).localeCompare(String(b.report.report_date), 'cs')
  )

  const header = companySettingsToHeader(company)
  const pdf = new VectorPdfDocument(header)
  await pdf.prepare()

  const workerName = `${sorted[0]!.worker.first_name} ${sorted[0]!.worker.last_name}`
  pdf.drawCompanyHeader({
    title: `Souhrnný výkaz – ${workerName}`,
    documentNumber: `VYK-BULK-${sorted.length}`,
  })

  pdf.drawParagraph(`Počet výkazů: ${sorted.length}. Seřazeno podle data.`)
  pdf.cursorY += 2

  for (let index = 0; index < sorted.length; index += 1) {
    const detail = sorted[index]!
    if (index > 0) pdf.addPage()
    else pdf.cursorY += 2

    pdf.drawSectionTitle(
      `Výkaz ${index + 1}/${sorted.length} · ${formatDate(detail.report.report_date)} · ${detail.report.order_name || '—'}`
    )
    await renderDailyReportBody(pdf, detail)
  }

  return pdf.toBlob()
}
