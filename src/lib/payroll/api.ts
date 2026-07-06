import { supabase } from '@/lib/supabase'
import type { PayrollFilters, PayrollPeriod, PayrollSlipDetail, PayrollSlipSummary } from '@/types/payroll'
import type { WorkerReport } from '@/types/workers'

export function getPayrollPeriod(year: number, month: number): PayrollPeriod {
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { year, month, dateFrom, dateTo }
}

export function getCurrentPayrollPeriod(): PayrollPeriod {
  const now = new Date()
  return getPayrollPeriod(now.getFullYear(), now.getMonth() + 1)
}

function filterBySearch(rows: PayrollSlipSummary[], search?: string): PayrollSlipSummary[] {
  if (!search?.trim()) return rows
  const q = search.toLowerCase().trim()
  return rows.filter((r) => {
    const name = `${r.worker_first_name} ${r.worker_last_name}`.toLowerCase()
    return name.includes(q)
  })
}

export async function fetchPayrollSummaries(filters: PayrollFilters): Promise<PayrollSlipSummary[]> {
  const period = getPayrollPeriod(filters.year, filters.month)

  const { data, error } = await supabase.rpc('get_payroll_slip_summaries', {
    p_date_from: period.dateFrom,
    p_date_to: period.dateTo,
    p_worker_id: filters.workerId ?? null,
  })

  if (error) throw new Error(error.message)

  const rows: PayrollSlipSummary[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    worker_id: String(row.worker_id),
    worker_first_name: String(row.worker_first_name),
    worker_last_name: String(row.worker_last_name),
    report_count: Number(row.report_count),
    total_earnings: Number(row.total_earnings),
    total_advances: Number(row.total_advances),
    net_amount: Number(row.net_amount),
  }))

  return filterBySearch(rows, filters.search)
}

export async function fetchPayrollSlipDetail(
  workerId: string,
  period: PayrollPeriod
): Promise<PayrollSlipDetail | null> {
  const { data: reports, error } = await supabase
    .from('worker_reports')
    .select('*')
    .eq('worker_id', workerId)
    .eq('status', 'schvaleny')
    .gte('report_date', period.dateFrom)
    .lte('report_date', period.dateTo)
    .order('report_date', { ascending: true })

  if (error) throw new Error(error.message)
  if (!reports?.length) return null

  const list = reports as WorkerReport[]
  const totalEarnings = list.reduce((sum, r) => sum + Number(r.earnings), 0)
  const totalAdvances = list.reduce((sum, r) => sum + Number(r.advance ?? 0), 0)

  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('first_name, last_name')
    .eq('id', workerId)
    .single()

  if (workerError) throw new Error(workerError.message)

  const w = worker as { first_name: string; last_name: string }

  const summary: PayrollSlipSummary = {
    worker_id: workerId,
    worker_first_name: w.first_name,
    worker_last_name: w.last_name,
    report_count: list.length,
    total_earnings: totalEarnings,
    total_advances: totalAdvances,
    net_amount: totalEarnings - totalAdvances,
  }

  return { summary, period, reports: list }
}
