import { supabase } from '@/lib/supabase'
import { approveDailyReport, returnDailyReport } from '@/lib/workers/module5'
import type { WorkerDailyForm, WorkerFormStatus } from '@/types/workers'

export interface DailyFormListRecord extends WorkerDailyForm {
  worker_first_name: string
  worker_last_name: string
}

export interface DailyFormFilters {
  workerId?: string
  orderId?: string
  status?: WorkerFormStatus | ''
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function fetchAllDailyForms(filters: DailyFormFilters = {}): Promise<DailyFormListRecord[]> {
  let query = supabase
    .from('worker_daily_forms')
    .select(`
      *,
      workers:worker_id ( first_name, last_name )
    `)

  if (filters.workerId) query = query.eq('worker_id', filters.workerId)
  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('form_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('form_date', filters.dateTo)

  const { data, error } = await query.order('form_date', { ascending: false })
  if (error) throw new Error(error.message)

  const rows: DailyFormListRecord[] = (
    (data ?? []) as Array<Record<string, unknown> & { workers?: { first_name: string; last_name: string } | null }>
  ).map((row) => {
    const worker = row.workers ?? null
    const { workers: _workers, ...rest } = row
    void _workers
    return {
      ...(rest as unknown as WorkerDailyForm),
      worker_first_name: worker?.first_name ?? '',
      worker_last_name: worker?.last_name ?? '',
    }
  })

  if (!filters.search?.trim()) return rows
  const q = filters.search.toLowerCase().trim()
  return rows.filter((r) => {
    const worker = `${r.worker_first_name} ${r.worker_last_name}`.toLowerCase()
    const order = (r.order_name ?? '').toLowerCase()
    return worker.includes(q) || order.includes(q)
  })
}

async function findReportIdForForm(formId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('worker_reports')
    .select('id')
    .eq('form_id', formId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.id ? String(data.id) : null
}

export async function approveDailyForm(formId: string, approvedBy: string): Promise<void> {
  const reportId = await findReportIdForForm(formId)
  if (reportId) {
    await approveDailyReport(reportId, approvedBy)
    return
  }

  const { error } = await supabase
    .from('worker_daily_forms')
    .update({ status: 'schvaleny' as WorkerFormStatus, approved_by: approvedBy })
    .eq('id', formId)

  if (error) throw new Error(error.message)
}

export async function returnDailyForm(formId: string, performedBy: string): Promise<void> {
  const reportId = await findReportIdForForm(formId)
  if (reportId) {
    await returnDailyReport(reportId, performedBy)
    return
  }

  const { error } = await supabase
    .from('worker_daily_forms')
    .update({ status: 'k_oprave' as WorkerFormStatus })
    .eq('id', formId)

  if (error) throw new Error(error.message)
}
