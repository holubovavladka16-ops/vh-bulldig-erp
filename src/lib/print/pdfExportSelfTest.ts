import { formatCurrency } from '@/constants/workers'
import { DAILY_ADVANCE_AMOUNT, buildReportPrintDocument } from '@/lib/module5/reportPrint'
import type { ReportDetail } from '@/types/workers'

/** Testovací data – 5 výkonů (hodiny, bm, ks), záloha 500 Kč, čitelný kontrast. */
export function buildPdfExportSelfTestDetail(): ReportDetail {
  const earnings = 12_450
  return {
    report: {
      id: 'test-report-001',
      worker_id: 'worker-001',
      form_id: 'form-001',
      report_date: '2026-07-14',
      order_id: 'order-001',
      order_name: 'RD Nová Ves – přípojka vody',
      activity: 'Výkop a pokládka potrubí',
      hours: 8,
      meters: 24,
      pieces: 3,
      earnings,
      material: 'PE potrubí DN 110',
      advance: DAILY_ADVANCE_AMOUNT,
      note: 'Testovací dokument pro ověření čitelnosti PDF exportu.',
      status: 'schvaleny',
      created_at: '2026-07-14T10:00:00Z',
    },
    form: {
      id: 'form-001',
      worker_id: 'worker-001',
      form_date: '2026-07-14',
      order_id: 'order-001',
      order_name: 'RD Nová Ves – přípojka vody',
      activity: 'Výkop a pokládka potrubí',
      work_type: 'ukolova',
      work_description: 'Výkop přípojky, pokládka PE potrubí, obsyp a hutnění.',
      work_start: '2026-07-14T07:00:00+02:00',
      work_end: '2026-07-14T15:30:00+02:00',
      break_minutes: 30,
      price_item_id: null,
      hours: 8,
      meters: 24,
      pieces: 3,
      advance: DAILY_ADVANCE_AMOUNT,
      material: 'PE potrubí DN 110',
      note: null,
      gps_lat: 49.1951,
      gps_lng: 16.6068,
      gps_accuracy: 8,
      signature_data: null,
      earnings,
      status: 'schvaleny',
      submitted_at: '2026-07-14T16:00:00Z',
      approved_by: 'admin',
      created_at: '2026-07-14T10:00:00Z',
      updated_at: '2026-07-14T16:00:00Z',
    },
    worker: {
      first_name: 'Jan',
      last_name: 'Novák',
      position: 'Strojník / dělník',
    },
    task_items: [
      { id: '1', price_item_id: 'p1', name: 'Práce strojník bagr', unit_type: 'hodina', price: 450, quantity: 8, line_earnings: 3600, sort_order: 1 },
      { id: '2', price_item_id: 'p2', name: 'Výkop běžný', unit_type: 'metr', price: 280, quantity: 24, line_earnings: 6720, sort_order: 2 },
      { id: '3', price_item_id: 'p3', name: 'Průraz pod komunikací', unit_type: 'kus', price: 350, quantity: 1, line_earnings: 350, sort_order: 3 },
      { id: '4', price_item_id: 'p4', name: 'Obsyp a hutnění', unit_type: 'metr', price: 120, quantity: 12, line_earnings: 1440, sort_order: 4 },
      { id: '5', price_item_id: 'p5', name: 'Doprava materiálu', unit_type: 'kus', price: 340, quantity: 1, line_earnings: 340, sort_order: 5 },
    ],
    photos: [],
  }
}

export function buildPdfExportSelfTestDocument(): string {
  return buildReportPrintDocument(buildPdfExportSelfTestDetail())
}

export interface PdfExportVerifyResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/** Kontrola výpočtu, kontrastu a povinných prvků v HTML exportu. */
export function verifyPdfExportSelfTestHtml(html: string): PdfExportVerifyResult {
  const errors: string[] = []
  const warnings: string[] = []
  const detail = buildPdfExportSelfTestDetail()
  const expectedNet = detail.report.earnings - DAILY_ADVANCE_AMOUNT

  if (!html.includes('pdf-document')) errors.push('Chybí třída pdf-document')
  if (!html.includes('pdf-watermark-layer')) errors.push('Chybí vodoznak')
  if (!html.includes('color-scheme: light only') && !html.includes('color-scheme:light only')) {
    warnings.push('Chybí color-scheme: light only')
  }
  if (html.includes('text-white')) errors.push('Nalezena zakázaná třída text-white')
  if (html.includes('dark:text')) errors.push('Nalezena dark mode třída v exportu')

  const whiteTextMatches = html.match(/color:\s*#fff(f{0,2})?/gi) ?? []
  const allowedWhite = whiteTextMatches.filter((m) => {
    const idx = html.indexOf(m)
    const slice = html.slice(Math.max(0, idx - 200), idx + 200)
    return !slice.includes('thead') && !slice.includes('#ffffff')
  })
  if (allowedWhite.length > 0) errors.push('Nalezena bílá barva textu mimo záhlaví tabulek')

  if (!html.includes('Docházka')) errors.push('Chybí sekce docházky')
  if (!html.includes('Vykázané práce')) errors.push('Chybí sekce výkonů')
  if (!html.includes('Rekapitulace výplaty')) errors.push('Chybí rekapitulace')
  if (!html.includes(formatCurrency(DAILY_ADVANCE_AMOUNT))) errors.push('Chybí záloha 500 Kč')
  if (!html.includes(formatCurrency(expectedNet))) errors.push(`Chybí částka k výplatě ${formatCurrency(expectedNet)}`)
  if (!html.includes('Podpis zaměstnance')) errors.push('Chybí podpis zaměstnance')
  if (!html.includes('Schválil')) errors.push('Chybí schválení')
  if (!html.includes('VH Bulldig')) errors.push('Chybí firemní hlavička')

  const workRows = (html.match(/doc-table-report-works/g) ?? []).length
  if (workRows < 1) errors.push('Chybí tabulka vykázaných prací')

  if (expectedNet !== 11_950) errors.push(`Špatný výpočet: očekáváno 11 950 Kč, je ${expectedNet}`)

  return { ok: errors.length === 0, errors, warnings }
}
