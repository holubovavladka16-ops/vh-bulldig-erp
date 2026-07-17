import { supabase } from '@/lib/supabase'
import type { FormCheckComparisonResult, CompareOutcome } from '@/types/formCheck'
import type { FormCheckOcrResult } from '@/types/formCheck'

export interface SaveFormCheckRecordInput {
  formId: string
  workerId: string
  month: number
  year: number
  outcome: CompareOutcome
  differenceCount: number
  ocrResult: FormCheckOcrResult
  comparisonResult: FormCheckComparisonResult
  photoPath: string | null
  checkedBy: string
}

export async function saveFormCheckRecord(input: SaveFormCheckRecordInput): Promise<string> {
  const { data, error } = await supabase
    .from('form_check_records')
    .insert({
      form_id: input.formId,
      worker_id: input.workerId,
      month: input.month,
      year: input.year,
      outcome: input.outcome,
      difference_count: input.differenceCount,
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
