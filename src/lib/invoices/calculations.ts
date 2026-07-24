import type { InvoiceLineInput, InvoiceVatMode } from '@/types/invoices'

export interface InvoiceTotals {
  subtotal: number
  vatAmount: number
  total: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function resolveVatRate(vatMode: InvoiceVatMode, lineVatRate?: number | null): number {
  if (vatMode === 'none') return 0
  if (lineVatRate != null) return lineVatRate
  return Number(vatMode)
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice)
}

export function calculateInvoiceTotals(
  lines: Pick<InvoiceLineInput, 'quantity' | 'unit_price' | 'vat_rate'>[],
  vatMode: InvoiceVatMode
): InvoiceTotals {
  let subtotal = 0
  let vatAmount = 0

  for (const line of lines) {
    const lineTotal = calculateLineTotal(line.quantity, line.unit_price)
    subtotal += lineTotal
    const rate = resolveVatRate(vatMode, line.vat_rate)
    vatAmount += lineTotal * (rate / 100)
  }

  subtotal = roundMoney(subtotal)
  vatAmount = roundMoney(vatAmount)

  return {
    subtotal,
    vatAmount,
    total: roundMoney(subtotal + vatAmount),
  }
}

export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
