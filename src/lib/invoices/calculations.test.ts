import { describe, expect, it } from 'vitest'
import { calculateInvoiceTotals, calculateLineTotal, resolveVatRate } from '@/lib/invoices/calculations'

describe('invoice calculations', () => {
  it('calculates line total', () => {
    expect(calculateLineTotal(120, 180)).toBe(21600)
  })

  it('calculates invoice totals with 21% VAT', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unit_price: 1000, vat_rate: 21 },
        { quantity: 2, unit_price: 500, vat_rate: 21 },
      ],
      '21'
    )
    expect(totals.subtotal).toBe(2000)
    expect(totals.vatAmount).toBe(420)
    expect(totals.total).toBe(2420)
  })

  it('returns zero VAT for none mode', () => {
    const totals = calculateInvoiceTotals([{ quantity: 3, unit_price: 100, vat_rate: 21 }], 'none')
    expect(totals.vatAmount).toBe(0)
    expect(totals.total).toBe(300)
  })

  it('resolves VAT rate from mode', () => {
    expect(resolveVatRate('12')).toBe(12)
    expect(resolveVatRate('none')).toBe(0)
  })
})
