import { supabase } from '@/lib/supabase'
import { fetchProjectsWithMarkersFromOrders } from '@/lib/zakazkyMapa/api'
import { createJobCost } from '@/lib/costs/api'
import { recalculateProjectMarkerColor } from '@/lib/zakazkyMapa/recalculateMarkerColor'
import type { JobCostCreateInput } from '@/types/costs'
import type { ConstructionDiaryCreateInput, ConstructionDiaryEntry } from '@/types/diary'
import type { DiaryEntryStatus } from '@/constants/diary'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export interface StavbyvedouciWorkerOption {
  id: string
  first_name: string
  last_name: string
  full_name: string
}

export interface StavbyvedouciAttendanceInput {
  worker_id: string
  order_id: string
  attendance_date: string
  work_start: string
  work_end: string
  break_minutes: number
  note?: string
}

const DIARY_ENTRY_SELECT =
  '*, job_orders(name, order_number), creator:profiles!construction_diary_entries_created_by_fkey(full_name, email)'

/** Přidělené zakázky se špendlíky – filtrováno RLS (včetně zakázek bez markeru). */
export async function fetchAssignedProjectsWithMarkers(): Promise<ProjectMapMarkerWithOrder[]> {
  return fetchProjectsWithMarkersFromOrders()
}

export async function fetchWorkersForAssignedOrder(
  orderId: string
): Promise<StavbyvedouciWorkerOption[]> {
  const { data, error } = await supabase.rpc('list_workers_for_assigned_order', {
    p_order_id: orderId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as StavbyvedouciWorkerOption[]
}

export async function insertStavbyvedouciAttendance(
  input: StavbyvedouciAttendanceInput
): Promise<void> {
  const hours = calcHours(input.work_start, input.work_end, input.break_minutes)
  const { error } = await supabase.from('worker_attendance_records').insert({
    worker_id: input.worker_id,
    order_id: input.order_id,
    attendance_date: input.attendance_date,
    hours,
    work_start: input.work_start || null,
    work_end: input.work_end || null,
    break_minutes: input.break_minutes,
    note: input.note?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

function calcHours(workStart: string, workEnd: string, breakMinutes: number): number {
  if (!workStart || !workEnd) return 0
  const [sh, sm] = workStart.split(':').map(Number)
  const [eh, em] = workEnd.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  const diff = Math.max(0, end - start - breakMinutes)
  return Math.round((diff / 60) * 100) / 100
}

function buildDiaryPayload(input: ConstructionDiaryCreateInput, createdBy: string, status: DiaryEntryStatus) {
  return {
    entry_date: input.entry_date,
    order_id: input.order_id,
    weather: input.weather.trim(),
    weather_type: input.weather_type,
    temperature_celsius: input.temperature_celsius,
    site_location: input.site_location.trim(),
    worker_count: input.worker_count,
    worker_names: input.worker_names.trim(),
    equipment: input.equipment.trim(),
    material: input.material.trim(),
    performances_summary: input.performances_summary.trim(),
    rough_work_description: input.rough_work_description.trim(),
    work_description: input.work_description.trim(),
    ai_work_description: input.ai_work_description.trim(),
    ai_assisted: input.ai_assisted,
    note: input.note.trim(),
    extraordinary_events: input.extraordinary_events.trim(),
    entry_status: status,
    created_by: createdBy,
  }
}

export async function createStavbyvedouciDiaryEntry(
  input: ConstructionDiaryCreateInput,
  createdBy: string,
  status: DiaryEntryStatus = 'draft'
): Promise<ConstructionDiaryEntry> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .insert(buildDiaryPayload(input, createdBy, status))
    .select(DIARY_ENTRY_SELECT)
    .single()

  if (error) throw new Error(error.message)
  await recalculateProjectMarkerColor(input.order_id)
  return data as ConstructionDiaryEntry
}

export async function updateStavbyvedouciDiaryEntry(
  id: string,
  input: ConstructionDiaryCreateInput,
  status?: DiaryEntryStatus
): Promise<ConstructionDiaryEntry> {
  const patch: Record<string, unknown> = {
    entry_date: input.entry_date,
    order_id: input.order_id,
    weather: input.weather.trim(),
    weather_type: input.weather_type,
    temperature_celsius: input.temperature_celsius,
    site_location: input.site_location.trim(),
    worker_count: input.worker_count,
    worker_names: input.worker_names.trim(),
    equipment: input.equipment.trim(),
    material: input.material.trim(),
    performances_summary: input.performances_summary.trim(),
    rough_work_description: input.rough_work_description.trim(),
    work_description: input.work_description.trim(),
    ai_work_description: input.ai_work_description.trim(),
    ai_assisted: input.ai_assisted,
    note: input.note.trim(),
    extraordinary_events: input.extraordinary_events.trim(),
  }
  if (status) patch.entry_status = status

  const { data, error } = await supabase
    .from('construction_diary_entries')
    .update(patch)
    .eq('id', id)
    .select(DIARY_ENTRY_SELECT)
    .single()

  if (error) throw new Error(error.message)
  await recalculateProjectMarkerColor(input.order_id)
  return data as ConstructionDiaryEntry
}

export async function fetchMyDiaryEntries(userId: string): Promise<ConstructionDiaryEntry[]> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .select(DIARY_ENTRY_SELECT)
    .eq('created_by', userId)
    .order('entry_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ConstructionDiaryEntry[]
}

export async function createStavbyvedouciCost(
  input: JobCostCreateInput,
  userId: string
): Promise<void> {
  await createJobCost(input, userId)
}

export async function fetchMyCosts(userId: string): Promise<
  Array<{
    id: string
    name: string
    cost_date: string
    category: string
    price: number
    job_orders: { name: string } | null
  }>
> {
  const { data, error } = await supabase
    .from('job_costs')
    .select('*, job_orders(name)')
    .eq('created_by', userId)
    .order('cost_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    name: string
    cost_date: string
    category: string
    price: number
    job_orders: { name: string } | null
  }>
}

export function canStavbyvedouciEditDiary(entry: ConstructionDiaryEntry, userId: string): boolean {
  if (entry.created_by !== userId) return false
  return entry.entry_status === 'draft' || entry.entry_status === 'returned'
}

export function groupDiaryByStatus(entries: ConstructionDiaryEntry[]) {
  return {
    draft: entries.filter((e) => e.entry_status === 'draft'),
    pending: entries.filter((e) => ['submitted', 'pending_review'].includes(e.entry_status)),
    returned: entries.filter((e) => e.entry_status === 'returned'),
    approved: entries.filter((e) => e.entry_status === 'approved'),
    rejected: entries.filter((e) => e.entry_status === 'rejected'),
  }
}
