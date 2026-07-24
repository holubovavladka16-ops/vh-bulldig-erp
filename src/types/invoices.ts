export type IssuedInvoiceStatus = 'koncept' | 'vytvorena' | 'odeslana' | 'zaplacena' | 'storno'

export type InvoicePaymentMethod = 'bankovni_prevod' | 'hotovost'

export type InvoiceTextVariant = 'prace' | 'pripravne_prace' | 'vlastni'

export type InvoiceVatMode = 'none' | '21' | '12'

export type InvoiceLineVatRate = 0 | 12 | 21

export type InvoiceLineSourceType = 'manual' | 'job_cost' | 'worker_report'

export interface InvoiceSettings {
  id: string
  company_name: string
  ico: string
  dic: string
  address: string
  city: string
  postal_code: string
  phone: string
  email: string
  website: string
  bank_account: string
  bank_name: string
  default_due_days: number
  is_vat_payer: boolean
  default_vat_rate: number
  logo_path: string | null
  signature_path: string | null
  stamp_path: string | null
  created_at: string
  updated_at: string
}

export interface IssuedInvoiceLine {
  id: string
  invoice_id: string
  sort_order: number
  name: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number | null
  line_total: number
  source_type: InvoiceLineSourceType | null
  source_id: string | null
  created_at: string
}

export interface IssuedInvoice {
  id: string
  invoice_number: string
  variable_symbol: string
  order_id: string | null
  order_name?: string
  status: IssuedInvoiceStatus
  issue_date: string
  taxable_date: string | null
  due_date: string | null
  payment_method: InvoicePaymentMethod
  text_variant: InvoiceTextVariant
  custom_text: string
  vat_mode: InvoiceVatMode
  customer_name: string
  customer_ico: string
  customer_dic: string
  customer_address: string
  customer_city: string
  customer_postal_code: string
  customer_email: string
  subtotal: number
  vat_amount: number
  total: number
  currency: string
  note: string | null
  sent_at: string | null
  sent_to_email: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  lines?: IssuedInvoiceLine[]
}

export interface InvoiceLineInput {
  id?: string
  name: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate?: number | null
  source_type?: InvoiceLineSourceType | null
  source_id?: string | null
}

export interface IssuedInvoiceInput {
  order_id?: string | null
  status?: IssuedInvoiceStatus
  issue_date: string
  taxable_date?: string | null
  due_date?: string | null
  payment_method: InvoicePaymentMethod
  text_variant: InvoiceTextVariant
  custom_text?: string
  vat_mode: InvoiceVatMode
  customer_name: string
  customer_ico: string
  customer_dic?: string
  customer_address?: string
  customer_city?: string
  customer_postal_code?: string
  customer_email?: string
  note?: string
  lines: InvoiceLineInput[]
}

export interface InvoiceFilters {
  search?: string
  status?: IssuedInvoiceStatus
  dateFrom?: string
  dateTo?: string
}

export interface AresCompanyData {
  ico: string
  name: string
  dic: string
  address: string
  city: string
  postal_code: string
}

export const INVOICE_STATUS_LABELS: Record<IssuedInvoiceStatus, string> = {
  koncept: 'Koncept',
  vytvorena: 'Vytvořena',
  odeslana: 'Odeslána',
  zaplacena: 'Zaplacená',
  storno: 'Storno',
}

export const INVOICE_TEXT_PRESETS: Record<Exclude<InvoiceTextVariant, 'vlastni'>, string> = {
  prace: 'Fakturujeme Vám za provedené práce:',
  pripravne_prace: 'Fakturujeme Vám za přípravné a dokončovací práce:',
}

export const INVOICE_UNITS = ['ks', 'hod', 'm', 'm²', 'm³', 'kpl', 'komplet'] as const

export const DEFAULT_INVOICE_SETTINGS: Omit<InvoiceSettings, 'id' | 'created_at' | 'updated_at'> = {
  company_name: 'VH Bulldig s.r.o.',
  ico: '',
  dic: '',
  address: '',
  city: '',
  postal_code: '',
  phone: '',
  email: '',
  website: '',
  bank_account: '',
  bank_name: '',
  default_due_days: 14,
  is_vat_payer: true,
  default_vat_rate: 21,
  logo_path: null,
  signature_path: null,
  stamp_path: null,
}
