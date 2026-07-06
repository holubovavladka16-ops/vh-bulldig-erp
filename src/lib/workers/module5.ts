import { supabase } from '@/lib/supabase'
import type {
  WorkerReport,
  WorkerAttendanceRecord,
  WorkerReportStatus,
  AttendanceStatus,
  ReportDetail,
  PortalAttendanceRecord,
} from '@/types/workers'

export interface ModuleListFilters {
  workerId?: string
  orderName?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  status?: WorkerReportStatus | ''
  attendanceStatus?: AttendanceStatus | ''
  sortBy?: 'date' | 'worker' | 'order'
  sortDir?: 'asc' | 'desc'
}

export interface AttendanceListRecord extends WorkerAttendanceRecord {
  worker_first_name: string
  worker_last_name: string
  form_signature?: string | null
  earnings?: number
  meters?: number
  pieces?: number
}

export interface ReportListRecord extends WorkerReport {
  worker_first_name: string
  worker_last_name: string
}

function applyDateFilters<T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
  query: T,
  dateFrom?: string,
  dateTo?: string,
  column = 'attendance_date'
): T {
  let q = query
  if (dateFrom) q = q.gte(column, dateFrom)
  if (dateTo) q = q.lte(column, dateTo)
  return q
}

function sortRecords<T extends AttendanceListRecord | ReportListRecord>(
  rows: T[],
  sortBy: ModuleListFilters['sortBy'],
  sortDir: ModuleListFilters['sortDir'],
  dateKey: 'attendance_date' | 'report_date'
): T[] {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortBy === 'worker') {
      const nameA = `${a.worker_last_name} ${a.worker_first_name}`
      const nameB = `${b.worker_last_name} ${b.worker_first_name}`
      return nameA.localeCompare(nameB, 'cs') * dir
    }
    if (sortBy === 'order') {
      return String(a.order_name ?? '').localeCompare(String(b.order_name ?? ''), 'cs') * dir
    }
    if (dateKey === 'attendance_date') {
      return String((a as AttendanceListRecord).attendance_date ?? '').localeCompare(
        String((b as AttendanceListRecord).attendance_date ?? ''),
        'cs'
      ) * dir
    }
    return String((a as ReportListRecord).report_date ?? '').localeCompare(
      String((b as ReportListRecord).report_date ?? ''),
      'cs'
    ) * dir
  })
}

function filterBySearch<T extends { worker_first_name?: string; worker_last_name?: string; order_name?: string; note?: string | null }>(
  rows: T[],
  search?: string
): T[] {
  if (!search?.trim()) return rows
  const q = search.toLowerCase().trim()
  return rows.filter((r) => {
    const worker = `${r.worker_first_name ?? ''} ${r.worker_last_name ?? ''}`.toLowerCase()
    const order = (r.order_name ?? '').toLowerCase()
    const note = (r.note ?? '').toLowerCase()
    return worker.includes(q) || order.includes(q) || note.includes(q)
  })
}

export async function fetchAllAttendance(filters: ModuleListFilters = {}): Promise<AttendanceListRecord[]> {
  let query = supabase
    .from('worker_attendance_records')
    .select(`
      *,
      workers:worker_id ( first_name, last_name ),
      worker_daily_forms:form_id ( earnings, meters, pieces, advance, signature_data )
    `)

  if (filters.workerId) query = query.eq('worker_id', filters.workerId)
  if (filters.orderName?.trim()) query = query.eq('order_id', filters.orderName)
  if (filters.attendanceStatus) query = query.eq('attendance_status', filters.attendanceStatus)
  query = applyDateFilters(query, filters.dateFrom, filters.dateTo, 'attendance_date')

  const { data, error } = await query.order('attendance_date', { ascending: false })
  if (error) throw new Error(error.message)

  const rows: AttendanceListRecord[] = ((data ?? []) as Array<
    Record<string, unknown> & {
      workers?: { first_name: string; last_name: string } | null
      worker_daily_forms?: {
        earnings: number
        meters: number
        pieces: number
        advance: number
        signature_data: string | null
      } | null
    }
  >).map((row) => {
    const worker = row.workers ?? null
    const form = row.worker_daily_forms ?? null
    const { workers: _workers, worker_daily_forms: _form, ...rest } = row
    void _workers
    void _form
    const record = rest as unknown as WorkerAttendanceRecord
    return {
      ...record,
      worker_first_name: worker?.first_name ?? '',
      worker_last_name: worker?.last_name ?? '',
      form_signature: form?.signature_data ?? null,
      earnings: form?.earnings != null ? Number(form.earnings) : undefined,
      meters: form?.meters != null ? Number(form.meters) : undefined,
      pieces: form?.pieces != null ? Number(form.pieces) : undefined,
      daily_advance: record.daily_advance ?? (form?.advance != null ? Number(form.advance) : 0),
    }
  })

  const filtered = filterBySearch(rows, filters.search)
  return sortRecords(filtered, filters.sortBy ?? 'date', filters.sortDir ?? 'desc', 'attendance_date')
}

export async function fetchAllReports(filters: ModuleListFilters = {}): Promise<ReportListRecord[]> {
  let query = supabase
    .from('worker_reports')
    .select(`
      *,
      workers:worker_id ( first_name, last_name )
    `)

  if (filters.workerId) query = query.eq('worker_id', filters.workerId)
  if (filters.orderName?.trim()) query = query.eq('order_id', filters.orderName)
  if (filters.status) query = query.eq('status', filters.status)
  query = applyDateFilters(query, filters.dateFrom, filters.dateTo, 'report_date')

  const { data, error } = await query.order('report_date', { ascending: false })
  if (error) throw new Error(error.message)

  const rows: ReportListRecord[] = ((data ?? []) as Array<Record<string, unknown> & { workers?: { first_name: string; last_name: string } | null }>).map((row) => {
    const worker = row.workers ?? null
    const { workers: _workers, ...rest } = row
    void _workers
    return {
      ...(rest as unknown as WorkerReport),
      worker_first_name: worker?.first_name ?? '',
      worker_last_name: worker?.last_name ?? '',
    }
  })

  const filtered = filterBySearch(rows, filters.search)
  return sortRecords(filtered, filters.sortBy ?? 'date', filters.sortDir ?? 'desc', 'report_date')
}

export async function fetchReportDetail(reportId: string): Promise<ReportDetail> {
  const { data, error } = await supabase.rpc('get_report_detail', { p_report_id: reportId })
  if (error) throw new Error(error.message)
  return data as ReportDetail
}

import { assertValidPortalToken } from '@/lib/workers/portalToken'

export async function portalGetAttendance(token: string): Promise<PortalAttendanceRecord[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_attendance', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as PortalAttendanceRecord[]
}

export async function portalGetReportDetail(token: string, reportId: string): Promise<ReportDetail> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_report_detail', {
    p_token: token,
    p_report_id: reportId,
  })
  if (error) throw new Error(error.message)
  return data as ReportDetail
}

export async function deleteDailyReport(reportId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_daily_report', { p_report_id: reportId })
  if (error) throw new Error(error.message)
}

export async function approveDailyReport(reportId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase.rpc('approve_daily_report', {
    p_report_id: reportId,
    p_approved_by: approvedBy,
  })
  if (error) throw new Error(error.message)
}

export async function returnDailyReport(reportId: string, performedBy: string): Promise<void> {
  const { error } = await supabase.rpc('return_daily_report', {
    p_report_id: reportId,
    p_performed_by: performedBy,
  })
  if (error) throw new Error(error.message)
}

export function getFormPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function fetchDistinctOrders(): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase
    .from('job_orders')
    .select('id, name')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: row.id as string, label: row.name as string }))
}
