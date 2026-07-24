import type { InvoiceableItem } from '@/types/invoiceableWorkReports'

/** Vygeneruje nabídku cen od price_from do price_to po price_step (vždy včetně price_to). */
export function generatePriceSteps(item: InvoiceableItem): number[] {
  const steps: number[] = []
  const stepsCount = Math.round((item.price_to - item.price_from) / item.price_step)

  for (let i = 0; i <= stepsCount; i++) {
    const value = Math.round((item.price_from + i * item.price_step) * 100) / 100
    steps.push(value)
  }

  if (steps.length === 0 || steps[steps.length - 1] !== item.price_to) {
    steps.push(Math.round(item.price_to * 100) / 100)
  }

  return steps
}

/** Zaokrouhlí libovolnou hodnotu ceny na 2 desetinná místa (peníze). */
export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100
}
