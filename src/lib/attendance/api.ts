import { supabase } from '@/lib/supabase'
import { formatSupabaseError, logSupabaseError } from '@/lib/supabaseErrors'
import type { AttendanceUpsertInput, WorkerAttendanceRecord } from '@/types/workers'
import { calcWorkHours } from '@/lib/workers/attendance'

export { calcWorkHours, formatTimeForInput } from '@/lib/workers/attendance'

export function calcAttendanceHours(
  status: AttendanceUpsertInput['attendance_status'],
  workStart: string,
  workEnd: string,
  breakMinutes: number
): number {
  if (status !== 'pritomen') return 0
  return calcWorkHours(workStart, workEnd, breakMinutes)
}

export async function upsertAttendanceRecord(
  input: AttendanceUpsertInput,
  performedBy: string,
  id?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_upsert_attendance', {
    p_worker_id: input.worker_id,
    p_attendance_date: input.attendance_date,
    p_order_id: input.order_id,
    p_work_start: input.work_start || null,
    p_work_end: input.work_end || null,
    p_break_minutes: input.break_minutes,
    p_attendance_status: input.attendance_status,
    p_note: input.note,
    p_id: id ?? null,
    p_performed_by: performedBy,
  })

  if (error) {
    logSupabaseError('upsertAttendanceRecord', error)
    throw new Error(formatSupabaseError(error))
  }

  return data as string
}

export async function deleteAttendanceRecord(id: string, performedBy: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_attendance', {
    p_id: id,
    p_performed_by: performedBy,
  })

  if (error) {
    logSupabaseError('deleteAttendanceRecord', error)
    throw new Error(formatSupabaseError(error))
  }
}

export async function fetchAttendanceRecord(id: string): Promise<WorkerAttendanceRecord | null> {
  const { data, error } = await supabase.from('worker_attendance_records').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as WorkerAttendanceRecord | null
}
