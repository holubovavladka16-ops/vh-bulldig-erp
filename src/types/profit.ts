export interface OrderProfitRow {
  order_id: string
  order_name: string
  period_from: string
  period_to: string
  invoiced_amount: number
  labor_costs: number
  employee_advances: number
  material_costs: number
  tools_costs: number
  rental_costs: number
  accommodation_costs: number
  fuel_costs: number
  tickets_costs: number
  other_costs: number
  total_costs: number
  net_profit: number
  profit_margin: number | null
}

export interface ProfitOverviewFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

export interface OrderInvoice {
  id: string
  order_id: string
  order_name?: string
  invoice_date: string
  invoice_number: string | null
  amount: number
  note: string | null
  created_by: string | null
  created_at: string
}

export interface OrderInvoiceCreateInput {
  order_id: string
  invoice_date: string
  invoice_number?: string
  amount: number
  note?: string
}
