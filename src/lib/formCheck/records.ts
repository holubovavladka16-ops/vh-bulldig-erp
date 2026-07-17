import { supabase } from '@/lib/supabase'
import { formatPaperPeriod } from '@/constants/paperForms'
import type {
  CompareOutcome,
  FormCheckComparisonResult,
  FormCheckHistoryFilters,
  FormCheckOcrResult,
  FormCheckRecordDetail,
  FormCheckRecordListItem,
  FormCheckStats,
} from '@/types/formCheck'

export interface SaveFormCheckRecordInput {
  formId: string
  formNumber: string
  workerId: string
  month: number
  year: number
  outcome: CompareOutcome
  differenceCount: number
  ocrConfidence: number | null
  ocrResult: FormCheckOcrResult
  comparisonResult: FormCheckComparisonResult
  photoPath: string | null
  checkedBy: string
}

interface FormCheckRecordRow {
  id: string
  form_id: string
  form_number: string | null
  worker_id: string
  month: number
  year: number
  checked_at: string
  outcome: CompareOutcome
  difference_count: number
  ocr_confidence: number | null
  photo_path: string | null
  checked_by: string | null
  ocr_result: FormCheckOcrResult
  comparison_result: FormCheckComparisonResult
  workers?: { first_name: string; last_name: string } | null
  paper_monthly_forms?: { form_number: string } | null
  profiles?: { full_name: string } | null
}

function mapListItem(row: FormCheckRecordRow): FormCheckRecordListItem {
  const worker = row.workers
  const formNumber = row.form_number ?? row.paper_monthly_forms?.form_number ?? '—'
  const workerName = worker ? `${worker.last_name} ${worker.first_name}` : '—'

  return {
    id: row.id,
    formId: row.form_id,
    formNumber,
    workerId: row.worker_id,
    workerName,
    month: row.month,
    year: row.year,
    periodLabel: formatPaperPeriod(row.month, row.year),
    checkedAt: row.checked_at,
    outcome: row.outcome,
    differenceCount: row.difference_count,
    ocrConfidence: row.ocr_confidence != null ? Number(row.ocr_confidence) : null,
    photoPath: row.photo_path,
    checkedById: row.checked_by,
    checkedByName: row.profiles?.full_name ?? null,
  }
}

export async function saveFormCheckRecord(input: SaveFormCheckRecordInput): Promise<string> {
  const { data, error } = await supabase
    .from('form_check_records')
    .insert({
      form_id: input.formId,
      form_number: input.formNumber,
      worker_id: input.workerId,
      month: input.month,
      year: input.year,
      outcome: input.outcome,
      difference_count: input.differenceCount,
      ocr_confidence: input.ocrConfidence,
      ocr_result: input.ocrResult,
      comparison_result: input.comparisonResult,
      photo_path: input.photoPath,
      checked_by: input.checkedBy,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

export async function fetchFormCheckRecords(
  filters: FormCheckHistoryFilters = {}
): Promise<FormCheckRecordListItem[]> {
  let query = supabase
    .from('form_check_records')
    .select(
      `
      id, form_id, form_number, worker_id, month, year, checked_at, outcome,
      difference_count, ocr_confidence, photo_path, checked_by,
      workers:worker_id ( first_name, last_name ),
      paper_monthly_forms:form_id ( form_number ),
      profiles:checked_by ( full_name )
    `
    )
    .order('checked_at', { ascending: false })

  if (filters.workerId) query = query.eq('worker_id', filters.workerId)
  if (filters.month) query = query.eq('month', filters.month)
  if (filters.year) query = query.eq('year', filters.year)
  if (filters.outcome) query = query.eq('outcome', filters.outcome)
  if (filters.checkedBy) query = query.eq('checked_by', filters.checkedBy)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as FormCheckRecordRow[]).map(mapListItem)
}

export async function fetchFormCheckRecord(recordId: string): Promise<FormCheckRecordDetail | null> {
  const { data, error } = await supabase
    .from('form_check_records')
    .select(
      `
      id, form_id, form_number, worker_id, month, year, checked_at, outcome,
      difference_count, ocr_confidence, photo_path, checked_by,
      ocr_result, comparison_result,
      workers:worker_id ( first_name, last_name ),
      paper_monthly_forms:form_id ( form_number ),
      profiles:checked_by ( full_name )
    `
    )
    .eq('id', recordId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as FormCheckRecordRow
  return {
    ...mapListItem(row),
    ocrResult: row.ocr_result,
    comparisonResult: row.comparison_result,
  }
}

export function computeFormCheckStats(records: FormCheckRecordListItem[]): FormCheckStats {
  const totalChecks = records.length
  const matchCount = records.filter((r) => r.outcome === 'match').length
  const mismatchCount = records.filter((r) => r.outcome === 'mismatch').length
  const manualReviewCount = records.filter((r) => r.outcome === 'manual_review').length

  const confidences = records
    .map((r) => r.ocrConfidence)
    .filter((v): v is number => v != null)

  const averageConfidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((sum, v) => sum + v, 0) / confidences.length) * 100)
      : null

  const ocrSuccessful = records.filter(
    (r) => r.ocrConfidence != null && r.ocrConfidence >= 0.8
  ).length

  const ocrSuccessRate =
    totalChecks > 0 ? Math.round((ocrSuccessful / totalChecks) * 100) : null

  return {
    totalChecks,
    matchCount,
    mismatchCount,
    manualReviewCount,
    ocrSuccessRate,
    averageConfidence,
  }
}

export async function fetchFormCheckStats(
  filters: FormCheckHistoryFilters = {}
): Promise<FormCheckStats> {
  const records = await fetchFormCheckRecords(filters)
  return computeFormCheckStats(records)
}

export async function getFormCheckPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('paper-forms').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

export async function fetchFormCheckAuditors(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('form_check_records')
    .select('checked_by, profiles:checked_by ( full_name )')
    .not('checked_by', 'is', null)

  if (error) throw new Error(error.message)

  const map = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ checked_by: string; profiles?: { full_name: string } | null }>) {
    if (row.checked_by) {
      map.set(row.checked_by, row.profiles?.full_name ?? row.checked_by)
    }
  }

  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
}
