import type { WorkerReport } from '@/types/workers'

export interface PayrollPeriod {
  year: number
  month: number
  dateFrom: string
  dateTo: string
}

export interface PayrollSlipSummary {
  worker_id: string
  worker_first_name: string
  worker_last_name: string
  report_count: number
  total_earnings: number
  total_advances: number
  net_amount: number
  pending_count?: number
}

export interface PayrollSlipDetail {
  summary: PayrollSlipSummary
  period: PayrollPeriod
  reports: WorkerReport[]
}

export interface PayrollFilters {
  workerId?: string
  search?: string
  year: number
  month: number
  /** Zahrnout čekající výkazy (náhled před schválením) */
  includePending?: boolean
}
