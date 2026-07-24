export type InvoiceableReportStatus = 'rozpracovany' | 'uzavreny'

export const INVOICEABLE_REPORT_STATUS_LABELS: Record<InvoiceableReportStatus, string> = {
  rozpracovany: 'Rozpracovaný',
  uzavreny: 'Uzavřený',
}

/** Hlavní fakturační výkaz – bez vlastní zakázky, ta je na úrovni řádků. */
export interface InvoiceableWorkReport {
  id: string
  name: string
  period_from: string
  period_to: string
  note: string | null
  customer_name: string | null
  contract_number: string | null
  purchase_order_number: string | null
  status: InvoiceableReportStatus
  closed_at: string | null
  closed_by: string | null
  reopened_at: string | null
  reopened_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Výkaz v přehledu se spočítaným součtem a počtem položek. */
export interface InvoiceableWorkReportListItem extends InvoiceableWorkReport {
  total_amount: number
  line_count: number
  order_count: number
  creator_name: string | null
}

/** Jeden řádek výkazu – vždy s vlastní zakázkou. */
export interface InvoiceableWorkReportLine {
  id: string
  report_id: string
  order_id: string
  order_name?: string | null
  work_date: string
  item_id: string | null
  item_name: string
  item_category: string | null
  unit: string
  quantity: number
  unit_price: number
  line_total: number
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceableWorkReportDetail extends InvoiceableWorkReport {
  lines: InvoiceableWorkReportLine[]
  creator_name: string | null
  closed_by_name: string | null
}

export type InvoiceableHistoryAction =
  | 'created'
  | 'line_added'
  | 'line_updated'
  | 'line_removed'
  | 'closed'
  | 'reopened'

export const INVOICEABLE_HISTORY_ACTION_LABELS: Record<InvoiceableHistoryAction, string> = {
  created: 'Vytvoření výkazu',
  line_added: 'Přidání položky',
  line_updated: 'Změna položky',
  line_removed: 'Odstranění položky',
  closed: 'Uzavření výkazu',
  reopened: 'Znovuotevření výkazu',
}

export interface InvoiceableHistoryEntry {
  id: string
  report_id: string
  line_id: string | null
  action: InvoiceableHistoryAction
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
  details: Record<string, unknown> | null
}

/** Položka fakturačního ceníku. */
export interface InvoiceableItem {
  id: string
  name: string
  category: string | null
  unit: string
  price_from: number
  price_to: number
  price_step: number
  default_price: number
  allow_custom_price: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceableOrderItemPrice {
  order_id: string
  item_id: string
  last_unit_price: number
  updated_at: string
}

export interface CreateInvoiceableReportInput {
  name: string
  period_from: string
  period_to: string
  note?: string
  customer_name?: string
  contract_number?: string
  purchase_order_number?: string
}

export interface UpdateInvoiceableReportInput {
  name: string
  period_from: string
  period_to: string
  note: string
  customer_name: string
  contract_number: string
  purchase_order_number: string
}

export interface CreateInvoiceableLineInput {
  order_id: string
  work_date: string
  item_id: string | null
  item_name: string
  item_category: string | null
  unit: string
  quantity: number
  unit_price: number
  note?: string
}

export type UpdateInvoiceableLineInput = CreateInvoiceableLineInput

export interface CreateInvoiceableItemInput {
  name: string
  category: string
  unit: string
  price_from: number
  price_to: number
  price_step: number
  default_price: number
  allow_custom_price: boolean
}

export interface OrderOption {
  id: string
  name: string
}

/** Součet za jednu zakázku v rámci výkazu (počítáno za běhu, nikde neuloženo). */
export interface OrderSubtotal {
  order_id: string
  order_name: string
  total: number
}
