import { describe, expect, it } from 'vitest'
import { buildInvoicePdfFileName } from '@/lib/invoices/pdf'
import { buildInvoiceShareText } from '@/lib/invoices/share'
import type { IssuedInvoice } from '@/types/invoices'

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
}

describe('invoice pdf helpers', () => {
  it('builds pdf file name from invoice number', () => {
    expect(buildInvoicePdfFileName(sampleInvoice)).toBe('faktura_202600001.pdf')
  })

  it('builds share text without email references', () => {
    const text = buildInvoiceShareText(sampleInvoice)
    expect(text).toContain('Faktura 202600001')
    expect(text).toContain('Test s.r.o.')
    expect(text).not.toContain('e-mail')
    expect(text).not.toContain('příloze')
  })
})
