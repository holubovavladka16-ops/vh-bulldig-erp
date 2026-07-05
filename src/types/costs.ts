export type JobCostCategory =
  | 'material'
  | 'naradi'
  | 'pujcovna'
  | 'ubytovani'
  | 'phm'
  | 'jizdenky'
  | 'ostatni'

export interface JobCost {
  id: string
  cost_date: string
  order_id: string
  order_name?: string
  name: string
  category: JobCostCategory
  price: number
  supplier: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface JobCostDocument {
  id: string
  cost_id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface JobCostPhoto {
  id: string
  cost_id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface JobCostCreateInput {
  cost_date: string
  order_id: string
  name: string
  category: JobCostCategory
  price: number
  supplier?: string
  note?: string
}

export interface JobCostFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

export interface JobCostWithAttachments extends JobCost {
  document: JobCostDocument | null
  photos: JobCostPhoto[]
}
