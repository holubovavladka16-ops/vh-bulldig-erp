import { describe, expect, it } from 'vitest'
import { buildReportBodyHtml, buildReportDocument } from '@/lib/invoiceableWorkReports/reportDocument'
import type { InvoiceableWorkReportDetail } from '@/types/invoiceableWorkReports'

const sampleReport: InvoiceableWorkReportDetail = {
  id: 'report-1',
  name: 'Výkaz červenec 2026',
  period_from: '2026-07-01',
  period_to: '2026-07-31',
  note: 'Poznámka s háčky a čárkami – žluťoučký kůň úpěl ďábelské ódy.',
  customer_name: 'Město Příbram',
  contract_number: 'SML-2026-001',
  purchase_order_number: 'OBJ-55',
  status: 'rozpracovany',
  closed_at: null,
  closed_by: null,
  reopened_at: null,
  reopened_by: null,
  created_by: null,
  created_at: '2026-07-01T08:00:00Z',
  updated_at: '2026-07-01T08:00:00Z',
  creator_name: 'Jan Novák',
  closed_by_name: null,
  lines: [
    {
      id: 'line-1',
      report_id: 'report-1',
      order_id: 'order-praha',
      order_name: 'Zakázka Praha',
      work_date: '2026-07-15',
      item_id: 'item-1',
      item_name: 'Ruční výkop',
      item_category: 'Výkopové práce',
      unit: 'bm',
      quantity: 40,
      unit_price: 320,
      line_total: 12800,
      note: null,
      created_by: null,
      created_at: '2026-07-15T08:00:00Z',
      updated_at: '2026-07-15T08:00:00Z',
    },
    {
      id: 'line-2',
      report_id: 'report-1',
      order_id: 'order-brno',
      order_name: 'Zakázka Brno',
      work_date: '2026-07-15',
      item_id: 'item-2',
      item_name: 'Montáž HDPE',
      item_category: null,
      unit: 'bm',
      quantity: 120,
      unit_price: 95,
      line_total: 11400,
      note: null,
      created_by: null,
      created_at: '2026-07-15T08:00:00Z',
      updated_at: '2026-07-15T08:00:00Z',
    },
  ],
}

describe('reportDocument (Fakturační výkaz prací PDF)', () => {
  it('obsahuje českou diakritiku beze změny (žádné mojibake)', () => {
    const html = buildReportBodyHtml(sampleReport)
    expect(html).toContain('žluťoučký kůň úpěl ďábelské ódy')
    expect(html).toContain('Příbram')
  })

  it('zobrazí objednatele, číslo smlouvy, číslo objednávky a poznámku, pokud jsou vyplněné', () => {
    const html = buildReportBodyHtml(sampleReport)
    expect(html).toContain('Město Příbram')
    expect(html).toContain('SML-2026-001')
    expect(html).toContain('OBJ-55')
  })

  it('nezobrazí prázdné volitelné údaje', () => {
    const html = buildReportBodyHtml({ ...sampleReport, contract_number: null, purchase_order_number: null })
    expect(html).not.toContain('Číslo smlouvy')
    expect(html).not.toContain('Číslo objednávky')
  })

  it('vykreslí všechny řádky s datem, zakázkou, položkou, MJ, množstvím, cenou a celkem', () => {
    const html = buildReportBodyHtml(sampleReport)
    expect(html).toContain('Zakázka Praha')
    expect(html).toContain('Zakázka Brno')
    expect(html).toContain('Ruční výkop')
    expect(html).toContain('Montáž HDPE')
  })

  it('spočítá samostatný součet za každou zakázku i celkový součet výkazu', () => {
    const html = buildReportBodyHtml(sampleReport)
    expect(html).toContain('12\u00a0800\u00a0Kč')
    expect(html).toContain('11\u00a0400\u00a0Kč')
    expect(html).toContain('24\u00a0200\u00a0Kč')
  })

  it('obsahuje místo pro podpis zhotovitele a objednatele', () => {
    const html = buildReportBodyHtml(sampleReport)
    expect(html).toContain('Podpis zhotovitele')
    expect(html).toContain('Podpis objednatele')
  })

  it('používá stejný sdílený dokumentový systém jako Fakturovač (doc-shell, doc-table, doc-footer)', () => {
    const full = buildReportDocument(sampleReport, null)
    expect(full).toContain('doc-shell')
    expect(full).toContain('doc-table')
    expect(full).toContain('doc-footer')
    expect(full).toContain('charset="utf-8"')
  })

  it('opakuje hlavičku tabulky na dalších stránkách při tisku (thead jako table-header-group)', () => {
    const full = buildReportDocument(sampleReport, null)
    expect(full).toContain('.doc-table thead { display: table-header-group; }')
  })

  it('obsahuje číslování stran (counter(page) / counter(pages))', () => {
    const full = buildReportDocument(sampleReport, null)
    expect(full).toContain('counter(page)')
    expect(full).toContain('counter(pages)')
  })

  it('nastavuje formát A4 na výšku', () => {
    const full = buildReportDocument(sampleReport, null)
    expect(full).toContain('@page { size: A4 portrait')
  })

  it('obsahuje název dokumentu Fakturační výkaz prací a název výkazu', () => {
    const full = buildReportDocument(sampleReport, null)
    expect(full).toContain('FAKTURAČNÍ VÝKAZ PRACÍ')
    expect(full).toContain('Výkaz červenec 2026')
  })
})
