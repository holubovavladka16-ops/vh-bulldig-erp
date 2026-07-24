import { formatCurrency, formatDate } from '@/constants/workers'
import type { Receipt } from '@/types/receipts'

export function buildReceiptShareText(receipt: Receipt): string {
  return [
    'Paragon k zaúčtování – VH Bulldig',
    '',
    `Datum: ${formatDate(receipt.receipt_date)}`,
    `Zakázka: ${receipt.order_name ?? '—'}`,
    `Název výdaje: ${receipt.expense_name}`,
    receipt.amount != null ? `Cena: ${formatCurrency(receipt.amount)}` : '',
    receipt.supplier ? `Dodavatel: ${receipt.supplier}` : '',
    receipt.note ? `Poznámka: ${receipt.note}` : '',
    '',
    `Adresa pořízení: ${receipt.address_full || '—'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, accountantEmail?: string, subject = 'Paragon k zaúčtování – VH Bulldig'): string {
  const to = accountantEmail?.trim() ? encodeURIComponent(accountantEmail.trim()) : ''
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}
