export interface Receipt {
  id: string
  receipt_date: string
  order_id: string
  order_name?: string
  expense_name: string
  amount: number | null
  supplier: string | null
  note: string | null
  file_path: string
  file_name: string
  captured_date: string
  captured_time: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReceiptCreateInput {
  receipt_date: string
  order_id: string
  expense_name: string
  amount?: number | null
  supplier?: string
  note?: string
}

export interface ReceiptCaptureMeta {
  file: File
  captured_at: Date
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
}

export interface ReceiptFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}
