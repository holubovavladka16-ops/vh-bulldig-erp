import { supabase } from '@/lib/supabase'
import { buildPaperMonthlyFormPdfBlob, getPaperFormPdfFilename } from '@/lib/paperForms/pdf'
import {
  buildBulkBlankPaperFormsPdfBlob,
  getBulkBlankPaperFormsPdfFilename,
} from '@/lib/paperForms/pdfBulk'
import { downloadPdfBlob, openPdfBlobInNewTab } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type {
  PaperFormAiLine,
  PaperFormLine,
  PaperFormListItem,
  PaperFormResolved,
  PaperMonthlyForm,
} from '@/types/paperForms'

export class DuplicateActivePaperFormError extends Error {
  existingFormId: string

  constructor(existingFormId: string) {
    super('DUPLICATE_ACTIVE_FORM')
    this.name = 'DuplicateActivePaperFormError'
    this.existingFormId = existingFormId
  }
}

function throwIfDuplicateActiveForm(error: { message?: string }): never {
  const msg = error.message ?? ''
  const match = msg.match(/DUPLICATE_ACTIVE_FORM:([0-9a-f-]+)/i)
  if (match) {
    throw new DuplicateActivePaperFormError(match[1]!)
  }
  throw new Error(error.message ?? 'Operace se nezdařila')
}

export interface PaperFormFilters {
  month?: number
  year?: number
  status?: string
  workerId?: string
  search?: string
}

export async function createPaperMonthlyForm(
  month: number,
  year: number,
  supervisorId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('create_paper_monthly_form', {
    p_month: month,
    p_year: year,
    p_supervisor_id: supervisorId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function assignPaperFormWorker(formId: string, workerId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_paper_monthly_form_worker', {
    p_form_id: formId,
    p_worker_id: workerId,
  })
  if (error) throwIfDuplicateActiveForm(error)
}

export async function resolvePaperFormByPublicId(publicId: string): Promise<PaperFormResolved | null> {
  const { data, error } = await supabase.rpc('resolve_paper_form_public_id', {
    p_public_id: publicId.trim(),
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as PaperFormResolved[]
  return rows[0] ?? null
}

export async function fetchPaperForms(filters: PaperFormFilters = {}): Promise<PaperFormListItem[]> {
  let query = supabase.from('paper_monthly_forms').select('*').order('year', { ascending: false }).order('month', { ascending: false })

  if (filters.month) query = query.eq('month', filters.month)
  if (filters.year) query = query.eq('year', filters.year)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.workerId) query = query.eq('worker_id', filters.workerId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let rows = (data ?? []) as PaperFormListItem[]
  rows = rows.map((row) => ({
    ...row,
    order_legend: Array.isArray(row.order_legend) ? row.order_legend : [],
    worker_name: row.worker_snapshot
      ? `${row.worker_snapshot.last_name} ${row.worker_snapshot.first_name}`
      : null,
  }))

  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase().trim()
    rows = rows.filter(
      (r) =>
        r.form_number.toLowerCase().includes(q) ||
        r.public_id.toLowerCase().includes(q) ||
        (r.worker_name ?? '').toLowerCase().includes(q)
    )
  }

  return rows
}

export async function fetchPaperForm(formId: string): Promise<PaperMonthlyForm | null> {
  const { data, error } = await supabase.from('paper_monthly_forms').select('*').eq('id', formId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as PaperMonthlyForm
  return {
    ...row,
    order_legend: Array.isArray(row.order_legend) ? row.order_legend : [],
  }
}

export async function fetchPaperFormLines(formId: string): Promise<PaperFormLine[]> {
  const { data, error } = await supabase
    .from('paper_monthly_form_lines')
    .select('*')
    .eq('paper_form_id', formId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PaperFormLine[]
}

export async function setPaperFormStatus(formId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('set_paper_form_status', {
    p_form_id: formId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function markPaperFormScanned(formId: string, scannedPhotoPath: string): Promise<void> {
  const { error } = await supabase.rpc('mark_paper_form_scanned', {
    p_form_id: formId,
    p_scanned_photo_path: scannedPhotoPath,
  })
  if (error) throw new Error(error.message)
}

export async function markPaperFormPrinted(formId: string, blankPdfPath?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_paper_form_printed', {
    p_form_id: formId,
    p_blank_pdf_path: blankPdfPath ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function updatePaperFormLine(lineId: string, patch: Partial<PaperFormLine>): Promise<void> {
  const { error } = await supabase.from('paper_monthly_form_lines').update(patch).eq('id', lineId)
  if (error) throw new Error(error.message)
}

export async function addPaperPerformanceLine(
  formId: string,
  input: Partial<PaperFormLine>
): Promise<PaperFormLine> {
  const { data: maxRow } = await supabase
    .from('paper_monthly_form_lines')
    .select('line_number, sort_order')
    .eq('paper_form_id', formId)
    .order('line_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxLineRow = maxRow as { line_number?: number; sort_order?: number } | null
  const nextLine = (maxLineRow?.line_number ?? 31) + 1
  const nextSort = (maxLineRow?.sort_order ?? 31) + 1

  const { data, error } = await supabase
    .from('paper_monthly_form_lines')
    .insert({
      paper_form_id: formId,
      line_number: nextLine,
      sort_order: nextSort,
      source_section: input.source_section ?? 'performance_breakdown',
      form_date: input.form_date,
      line_role: input.line_role ?? 'performance',
      order_code: input.order_code ?? null,
      order_id: input.order_id ?? null,
      order_name_resolved: input.order_name_resolved ?? null,
      price_item_id: input.price_item_id ?? null,
      work_type_text: input.work_type_text ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      performance_hours: input.performance_hours ?? null,
      material: input.material ?? '',
      note: input.note ?? '',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as PaperFormLine
}

export async function applyPaperFormAiImport(
  formId: string,
  lines: PaperFormAiLine[],
  summary: Record<string, unknown>,
  aiRaw: Record<string, unknown>,
  aiConfidence: number | null,
  aiModel: string,
  scannedPhotoPath?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('apply_paper_form_ai_import', {
    p_form_id: formId,
    p_lines: lines,
    p_summary: summary,
    p_ai_raw: aiRaw,
    p_ai_confidence: aiConfidence,
    p_ai_model: aiModel,
    p_scanned_photo_path: scannedPhotoPath ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function commitPaperMonthlyForm(formId: string, performedBy: string): Promise<{ created_forms: number }> {
  const { data, error } = await supabase.rpc('commit_paper_monthly_form', {
    p_form_id: formId,
    p_performed_by: performedBy,
  })
  if (error) throw new Error(error.message)
  return (data ?? { created_forms: 0 }) as { created_forms: number }
}

export async function uploadPaperFormScan(formId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${formId}/scan-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('paper-forms').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)
  return path
}

export async function getPaperFormScanUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('paper-forms').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

export async function resolveOrderIdByShortCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_order_by_short_code', { p_code: code })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

export interface WorkerActivePaperForm {
  id: string
  form_number: string
  public_id: string
  status: string
  printed_at: string | null
  month: number
  year: number
}

export async function fetchWorkerActivePaperForm(
  workerId: string,
  month: number,
  year: number
): Promise<WorkerActivePaperForm | null> {
  const { data, error } = await supabase.rpc('get_worker_active_paper_form', {
    p_worker_id: workerId,
    p_month: month,
    p_year: year,
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as WorkerActivePaperForm[]
  return rows[0] ?? null
}

export async function createPaperMonthlyFormForWorker(
  workerId: string,
  month: number,
  year: number,
  supervisorId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('create_paper_monthly_form_for_worker', {
    p_worker_id: workerId,
    p_month: month,
    p_year: year,
    p_supervisor_id: supervisorId ?? null,
  })
  if (error) throwIfDuplicateActiveForm(error)
  return data as string
}

export async function createPaperMonthlyReplacementForm(
  workerId: string,
  month: number,
  year: number,
  supervisorId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('create_paper_monthly_replacement_form', {
    p_worker_id: workerId,
    p_month: month,
    p_year: year,
    p_supervisor_id: supervisorId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function printPaperMonthlyFormPdf(
  formId: string,
  company: CompanySettings
): Promise<PaperMonthlyForm> {
  const [form, lines] = await Promise.all([fetchPaperForm(formId), fetchPaperFormLines(formId)])
  if (!form) throw new Error('Formulář nenalezen')
  const blob = await buildPaperMonthlyFormPdfBlob(form, lines, company)
  const filename = getPaperFormPdfFilename(form)
  if (!openPdfBlobInNewTab(blob)) {
    downloadPdfBlob(blob, filename)
  }
  await markPaperFormPrinted(form.id)
  return form
}

export async function createAndPrintBulkBlankPaperForms(
  month: number,
  year: number,
  count: number,
  company: CompanySettings,
  supervisorId?: string | null
): Promise<string[]> {
  if (count < 1 || count > 50) {
    throw new Error('Počet formulářů musí být mezi 1 a 50')
  }

  const formIds: string[] = []
  for (let i = 0; i < count; i++) {
    formIds.push(await createPaperMonthlyForm(month, year, supervisorId ?? null))
  }

  const items = await Promise.all(
    formIds.map(async (id) => {
      const [form, lines] = await Promise.all([fetchPaperForm(id), fetchPaperFormLines(id)])
      if (!form) throw new Error(`Formulář ${id} nenalezen`)
      return { form, lines }
    })
  )

  const blob = await buildBulkBlankPaperFormsPdfBlob(items, company)
  const filename = getBulkBlankPaperFormsPdfFilename(month, year, count)
  if (!openPdfBlobInNewTab(blob)) {
    downloadPdfBlob(blob, filename)
  }

  await Promise.all(formIds.map((id) => markPaperFormPrinted(id)))
  return formIds
}

export async function cancelPaperMonthlyForm(formId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_paper_monthly_form', {
    p_form_id: formId,
    p_reason: reason ?? 'Zrušeno administrátorem',
  })
  if (error) throw new Error(error.message)
}
