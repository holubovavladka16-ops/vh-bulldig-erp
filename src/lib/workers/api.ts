import { supabase } from '@/lib/supabase'
import { normalizePriceItems } from '@/lib/workers/earnings'
import { formatSupabaseError, logSupabaseError } from '@/lib/supabaseErrors'
import { normalizeDateForDb } from '@/lib/dates'
import { WORKER_STATUS_LABELS } from '@/constants/workers'
import { assertValidPortalToken } from '@/lib/workers/portalToken'
import type {
  Worker,
  WorkerCreateInput,
  WorkerPriceItem,
  WorkerDocument,
  WorkerDailyForm,
  WorkerReport,
  WorkerAttendanceRecord,
  WorkerHistoryEntry,
  WorkerEarningsSummary,
  PortalWorker,
  PortalDailyAdvance,
  WorkerFilter,
  WorkerDocumentCategory,
  WorkerFormStatus,
  WorkType,
  TaskLineInput,
  WorkerFormTaskItem,
} from '@/types/workers'

function serializeTaskItems(items: TaskLineInput[]): { price_item_id: string; quantity: number }[] {
  return items
    .filter((t) => t.quantity > 0)
    .map(({ price_item_id, quantity }) => ({ price_item_id, quantity }))
}

function normalizeWorker(worker: Worker): Worker {
  return {
    ...worker,
    birth_date: normalizeDateForDb(worker.birth_date),
    start_date: normalizeDateForDb(worker.start_date),
    end_date: worker.end_date ? normalizeDateForDb(worker.end_date) : null,
  }
}

export async function fetchWorkers(filter: WorkerFilter = 'vse', search = ''): Promise<Worker[]> {
  let query = supabase.from('workers').select('*').order('last_name').order('first_name')

  if (filter === 'aktivni') query = query.eq('status', 'aktivni')
  else if (filter === 'neaktivni') query = query.eq('status', 'neaktivni')
  else if (filter === 'archiv') query = query.eq('status', 'archiv')

  const { data, error } = await query
  if (error) {
    logSupabaseError('fetchWorkers', error)
    throw new Error(formatSupabaseError(error))
  }

  let workers = (data ?? []).map((row) => normalizeWorker(row as Worker))

  if (search.trim()) {
    const q = search.toLowerCase().trim()
    workers = workers.filter(
      (w) =>
        w.first_name.toLowerCase().includes(q) ||
        w.last_name.toLowerCase().includes(q) ||
        (w.phone ?? '').includes(q) ||
        w.position.toLowerCase().includes(q)
    )
  }

  return workers
}

export async function fetchWorker(id: string): Promise<Worker | null> {
  const { data, error } = await supabase.from('workers').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalizeWorker(data as Worker) : null
}

function normalizeWorkerPayload(input: Partial<WorkerCreateInput>): Record<string, unknown> {
  const nullableKeys = new Set([
    'phone',
    'email',
    'birth_number',
    'nationality',
    'note',
    'assigned_order_id',
    'photo_url',
  ])
  const dateKeys = new Set(['birth_date', 'start_date', 'end_date'])

  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    if (dateKeys.has(key) && typeof value === 'string') {
      payload[key] = value === '' ? null : normalizeDateForDb(value)
      continue
    }
    payload[key] = nullableKeys.has(key) && value === '' ? null : value
  }
  return payload
}

export async function createWorker(input: WorkerCreateInput, createdBy: string): Promise<Worker> {
  const payload = normalizeWorkerPayload(input)
  const { data, error } = await supabase
    .from('workers')
    .insert({ ...payload, created_by: createdBy })
    .select('*')
    .single()

  if (error) {
    logSupabaseError('createWorker', error)
    throw new Error(formatSupabaseError(error))
  }
  return normalizeWorker(data as Worker)
}

export async function updateWorker(id: string, input: Partial<WorkerCreateInput>): Promise<Worker> {
  const payload = normalizeWorkerPayload(input)
  const { data, error } = await supabase.from('workers').update(payload).eq('id', id).select('*').single()
  if (error) {
    logSupabaseError('updateWorker', error)
    throw new Error(formatSupabaseError(error))
  }
  return normalizeWorker(data as Worker)
}

export async function archiveWorker(id: string, performedBy: string): Promise<void> {
  const { error } = await supabase
    .from('workers')
    .update({ status: 'archiv', end_date: new Date().toISOString().split('T')[0] })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabase.from('worker_history').insert({
    worker_id: id,
    action: 'Zaměstnanec archivován',
    performed_by: performedBy,
  })
}

export async function restoreWorker(id: string, performedBy: string): Promise<void> {
  const { error } = await supabase
    .from('workers')
    .update({ status: 'aktivni', end_date: null })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabase.from('worker_history').insert({
    worker_id: id,
    action: 'Zaměstnanec obnoven',
    performed_by: performedBy,
  })
}

export async function deleteWorker(id: string): Promise<void> {
  const { error } = await supabase.from('workers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setWorkerStatus(
  id: string,
  status: Worker['status'],
  performedBy: string
): Promise<void> {
  const { error } = await supabase.from('workers').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)

  await supabase.from('worker_history').insert({
    worker_id: id,
    action: `Stav změněn na ${WORKER_STATUS_LABELS[status]}`,
    performed_by: performedBy,
  })
}

export async function fetchPriceItems(workerId: string): Promise<WorkerPriceItem[]> {
  const { data, error } = await supabase
    .from('worker_price_items')
    .select('*')
    .eq('worker_id', workerId)
    .order('sort_order')

  if (error) throw new Error(error.message)
  return normalizePriceItems((data ?? []) as WorkerPriceItem[])
}

export async function createPriceItem(
  workerId: string,
  item: Pick<WorkerPriceItem, 'name' | 'unit_type' | 'price'>
): Promise<WorkerPriceItem> {
  const existing = await fetchPriceItems(workerId)
  const maxOrder = existing.reduce((max, i) => Math.max(max, i.sort_order), 0)

  const { data, error } = await supabase
    .from('worker_price_items')
    .insert({
      worker_id: workerId,
      ...item,
      is_default: false,
      is_active: true,
      sort_order: maxOrder + 1,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as WorkerPriceItem
}

export async function updatePriceItem(
  id: string,
  updates: Partial<Pick<WorkerPriceItem, 'name' | 'unit_type' | 'price' | 'is_active' | 'sort_order'>>
): Promise<void> {
  const { error } = await supabase.from('worker_price_items').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reorderPriceItems(workerId: string, itemIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_worker_price_items', {
    p_worker_id: workerId,
    p_item_ids: itemIds,
  })
  if (error) throw new Error(error.message)
}

export async function deletePriceItem(id: string): Promise<void> {
  const { error } = await supabase.from('worker_price_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchDocuments(workerId: string): Promise<WorkerDocument[]> {
  const { data, error } = await supabase
    .from('worker_documents')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerDocument[]
}

export async function uploadDocument(
  workerId: string,
  category: WorkerDocumentCategory,
  title: string,
  file: File,
  uploadedBy: string
): Promise<WorkerDocument> {
  const path = `${workerId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('worker-documents').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('worker_documents')
    .insert({
      worker_id: workerId,
      category,
      title,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as WorkerDocument
}

export async function deleteDocument(id: string, filePath: string): Promise<void> {
  await supabase.storage.from('worker-documents').remove([filePath])
  const { error } = await supabase.from('worker_documents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchReports(workerId: string): Promise<WorkerReport[]> {
  const { data, error } = await supabase
    .from('worker_reports')
    .select('*')
    .eq('worker_id', workerId)
    .order('report_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerReport[]
}

export async function fetchAttendance(workerId: string): Promise<WorkerAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('worker_attendance_records')
    .select('*')
    .eq('worker_id', workerId)
    .order('attendance_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerAttendanceRecord[]
}

export async function fetchHistory(workerId: string): Promise<WorkerHistoryEntry[]> {
  const { data, error } = await supabase
    .from('worker_history')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerHistoryEntry[]
}

export async function fetchForms(workerId: string): Promise<WorkerDailyForm[]> {
  const { data, error } = await supabase
    .from('worker_daily_forms')
    .select('*')
    .eq('worker_id', workerId)
    .order('form_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerDailyForm[]
}

export async function approveForm(formId: string, workerId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('worker_daily_forms')
    .update({ status: 'schvaleny' as WorkerFormStatus, approved_by: approvedBy })
    .eq('id', formId)

  if (error) throw new Error(error.message)

  await supabase.from('worker_reports').update({ status: 'schvaleny' }).eq('form_id', formId)
  await supabase.from('worker_history').insert({
    worker_id: workerId,
    action: 'Formulář schválen',
    details: { form_id: formId },
    performed_by: approvedBy,
  })
}

export async function returnFormForCorrection(formId: string, workerId: string, performedBy: string): Promise<void> {
  const { error } = await supabase
    .from('worker_daily_forms')
    .update({ status: 'k_oprave' as WorkerFormStatus })
    .eq('id', formId)

  if (error) throw new Error(error.message)

  await supabase.from('worker_reports').update({ status: 'k_oprave' }).eq('form_id', formId)
  await supabase.from('worker_history').insert({
    worker_id: workerId,
    action: 'Formulář vrácen k opravě',
    details: { form_id: formId },
    performed_by: performedBy,
  })
}

export async function uploadWorkerPhoto(workerId: string, file: File): Promise<string> {
  const path = `${workerId}/photo_${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('worker-photos').upload(path, file, { upsert: true })
  if (uploadError) {
    logSupabaseError('uploadWorkerPhoto.storage', uploadError)
    throw new Error(formatSupabaseError(uploadError))
  }

  const { data } = supabase.storage.from('worker-photos').getPublicUrl(path)
  const url = data.publicUrl

  const { error: updateError } = await supabase.from('workers').update({ photo_url: url }).eq('id', workerId)
  if (updateError) {
    logSupabaseError('uploadWorkerPhoto.update', updateError)
    throw new Error(formatSupabaseError(updateError))
  }
  return url
}

// Portál zaměstnance (RPC – pouze data daného zaměstnance přes token)
export async function portalGetWorker(token: string): Promise<PortalWorker | null> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_worker', { p_token: token })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as PortalWorker[]
  return rows[0] ?? null
}

export async function portalGetPriceItems(token: string): Promise<WorkerPriceItem[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_price_items', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerPriceItem[]
}

export async function portalGetForms(token: string): Promise<WorkerDailyForm[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_forms', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerDailyForm[]
}

export async function portalGetReports(token: string): Promise<WorkerReport[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_reports', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerReport[]
}

export async function portalGetEarningsSummary(token: string): Promise<WorkerEarningsSummary | null> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_earnings_summary', { p_token: token })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as WorkerEarningsSummary[]
  return rows[0] ?? null
}

export async function portalGetDailyAdvances(token: string): Promise<PortalDailyAdvance[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_daily_advances', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as PortalDailyAdvance[]
}

export interface PortalFormInput {
  form_id?: string | null
  form_date: string
  order_id: string
  work_start: string
  work_end: string
  break_minutes: number
  advance: number
  material: string
  note: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  signature_data: string | null
  task_items: TaskLineInput[]
}

export async function portalSaveForm(token: string, form: PortalFormInput): Promise<string> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_save_form', {
    p_token: token,
    p_form_id: form.form_id ?? null,
    p_form_date: form.form_date,
    p_order_id: form.order_id,
    p_work_start: form.work_start || null,
    p_work_end: form.work_end || null,
    p_break_minutes: form.break_minutes,
    p_advance: form.advance,
    p_material: form.material,
    p_note: form.note,
    p_gps_lat: form.gps_lat,
    p_gps_lng: form.gps_lng,
    p_gps_accuracy: form.gps_accuracy,
    p_signature_data: form.signature_data,
    p_task_items: serializeTaskItems(form.task_items),
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function portalGetFormTaskItems(
  token: string,
  formId: string
): Promise<WorkerFormTaskItem[]> {
  assertValidPortalToken(token)
  const { data, error } = await supabase.rpc('portal_get_form_task_items', {
    p_token: token,
    p_form_id: formId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerFormTaskItem[]
}

export async function adminGetFormTaskItems(formId: string): Promise<WorkerFormTaskItem[]> {
  const { data, error } = await supabase.rpc('admin_get_form_task_items', { p_form_id: formId })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkerFormTaskItem[]
}

export interface AdminFormInput {
  form_date: string
  order_id: string | null
  work_type: WorkType
  work_description: string
  work_start: string
  work_end: string
  break_minutes: number
  advance: number
  material: string
  note: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  signature_data: string | null
  task_items: TaskLineInput[]
}

export async function adminSaveForm(formId: string, form: AdminFormInput): Promise<string> {
  const { data, error } = await supabase.rpc('admin_save_form', {
    p_form_id: formId,
    p_form_date: form.form_date,
    p_order_id: form.order_id,
    p_work_type: form.work_type,
    p_work_description: form.work_description,
    p_work_start: form.work_start || null,
    p_work_end: form.work_end || null,
    p_break_minutes: form.break_minutes,
    p_advance: form.advance,
    p_material: form.material,
    p_note: form.note,
    p_gps_lat: form.gps_lat,
    p_gps_lng: form.gps_lng,
    p_gps_accuracy: form.gps_accuracy,
    p_signature_data: form.signature_data,
    p_task_items: serializeTaskItems(form.task_items),
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function portalSubmitForm(token: string, formId: string): Promise<void> {
  assertValidPortalToken(token)
  const { error } = await supabase.rpc('portal_submit_form', { p_token: token, p_form_id: formId })
  if (error) throw new Error(error.message)
}

export async function adminRegeneratePortalToken(workerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_regenerate_portal_token', { p_worker_id: workerId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function uploadFormPhoto(formId: string, file: File, portalToken?: string): Promise<void> {
  const path = `${formId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('worker-photos').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  if (portalToken) {
    assertValidPortalToken(portalToken)
    const { error } = await supabase.rpc('portal_add_form_photo', {
      p_token: portalToken,
      p_form_id: formId,
      p_file_path: path,
      p_file_name: file.name,
    })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('worker_form_photos').insert({
      form_id: formId,
      file_path: path,
      file_name: file.name,
    })
    if (error) throw new Error(error.message)
  }
}
