import { describe, expect, it } from 'vitest'
import { generatePriceSteps, roundPrice } from '@/lib/invoiceableWorkReports/pricing'
import type { InvoiceableItem } from '@/types/invoiceableWorkReports'

const sampleItem: InvoiceableItem = {
  id: 'item-1',
  name: 'Ruční výkop 60 cm',
  category: 'Výkopové práce',
  unit: 'bm',
  price_from: 250,
  price_to: 400,
  price_step: 10,
  default_price: 320,
  allow_custom_price: true,
  is_active: true,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('generatePriceSteps', () => {
  it('vygeneruje ceny od price_from do price_to po price_step', () => {
    const steps = generatePriceSteps(sampleItem)
    expect(steps[0]).toBe(250)
    expect(steps[steps.length - 1]).toBe(400)
    expect(steps).toContain(320)
    expect(steps.length).toBe(16)
  })

  it('vždy zahrne price_to, i kdyby krok nevyšel přesně', () => {
    const item = { ...sampleItem, price_from: 100, price_to: 155, price_step: 20 }
    const steps = generatePriceSteps(item)
    expect(steps[steps.length - 1]).toBe(155)
  })
})

describe('roundPrice', () => {
  it('zaokrouhlí na 2 desetinná místa', () => {
    expect(roundPrice(12.3456)).toBe(12.35)
    expect(roundPrice(10)).toBe(10)
  })
})
