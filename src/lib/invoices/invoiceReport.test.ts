import { describe, expect, it } from 'vitest'
import { buildInvoiceReportDocument, buildInvoiceReportHtml } from '@/lib/invoices/invoiceReport'
import { DEFAULT_INVOICE_SETTINGS, type IssuedInvoice } from '@/types/invoices'

const sampleInvoice: IssuedInvoice = {
  id: 'inv-1',
  invoice_number: '202600001',
  variable_symbol: '202600001',
  order_id: null,
  status: 'vytvorena',
  issue_date: '2026-07-22',
  taxable_date: '2026-07-22',
  due_date: '2026-08-05',
  payment_method: 'bankovni_prevod',
  text_variant: 'prace',
  custom_text: '',
  vat_mode: '21',
  customer_name: 'Test s.r.o.',
  customer_ico: '12345678',
  customer_dic: 'CZ12345678',
  customer_address: 'Hlavní 1',
  customer_city: 'Praha',
  customer_postal_code: '11000',
  customer_email: '',
  subtotal: 1000,
  vat_amount: 210,
  total: 1210,
  currency: 'CZK',
  note: null,
  sent_at: null,
  sent_to_email: null,
  created_by: null,
  created_at: '2026-07-22T10:00:00Z',
  updated_at: '2026-07-22T10:00:00Z',
  lines: [
    {
      id: 'line-1',
      invoice_id: 'inv-1',
      name: 'Stavební práce',
      quantity: 10,
      unit: 'hod',
      unit_price: 100,
      vat_rate: 21,
      line_total: 1000,
      source_type: null,
      source_id: null,
      sort_order: 0,
      created_at: '2026-07-22T10:00:00Z',
    },
  ],
}

const settings = {
  ...DEFAULT_INVOICE_SETTINGS,
  id: 'settings-1',
  created_at: '2026-07-22T10:00:00Z',
  updated_at: '2026-07-22T10:00:00Z',
  company_name: 'VH Bulldig s.r.o.',
  ico: '12345678',
  dic: 'CZ12345678',
  bank_account: '123456789/0100',
}

describe('invoiceReport template', () => {
  it('renders right-aligned totals with CZK formatting', () => {
    const html = buildInvoiceReportHtml(sampleInvoice, settings)
    expect(html).toContain('class="amount">1\u00a0000\u00a0Kč')
    expect(html).toContain('class="amount">210\u00a0Kč')
    expect(html).toContain('class="amount grand">1\u00a0210\u00a0Kč')
    expect(html).toContain('class="grand-row"')
  })

  it('uses only podpis and razitko in footer signatures', () => {
    const html = buildInvoiceReportHtml(sampleInvoice, settings)
    expect(html).toContain('invoice-sign-caption">Podpis')
    expect(html).toContain('invoice-sign-caption">Razítko')
    expect(html).not.toContain('invoice-sign-caption">Dodavatel')
    expect(html).not.toMatch(/invoice-signatures[\s\S]*alt="Logo"/)
  })

  it('keeps a single watermark in full document when logo exists', () => {
    const html = buildInvoiceReportDocument(sampleInvoice, {
      ...settings,
      logo_path: 'company/logo.png',
    })
    const watermarkCount = (html.match(/class="doc-watermark"/g) ?? []).length
    expect(watermarkCount).toBe(1)
    expect(html).toContain('opacity: 0.035 !important')
  })

  it('uses uniform 4mm page margins in invoice template', () => {
    const html = buildInvoiceReportDocument(sampleInvoice, settings)
    expect(html).toContain('@page { size: A4 portrait; margin: 4mm; }')
    expect(html).toContain('padding: 4mm !important')
    expect(html).toContain('left: 4mm !important')
    expect(html).toContain('right: 4mm !important')
    expect(html).toContain('bottom: 4mm !important')
  })
})
