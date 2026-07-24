import { supabase } from '@/lib/supabase'
import type { FormCheckOcrResult } from '@/types/formCheck'
import type { PaperOrderLegendItem } from '@/types/paperForms'

export interface FormCheckOcrRequest {
  file: File
  formNumber: string
  month: number
  year: number
  workerName?: string | null
  orderLegend: PaperOrderLegendItem[]
}

function normalizeOcrResult(payload: Record<string, unknown>): FormCheckOcrResult {
  const lines = Array.isArray(payload.lines) ? payload.lines : []

  return {
    workerName: typeof payload.worker_name === 'string' ? payload.worker_name : null,
    monthLabel: typeof payload.month_label === 'string' ? payload.month_label : null,
    month: typeof payload.month === 'number' ? payload.month : 0,
    year: typeof payload.year === 'number' ? payload.year : 0,
    lines: lines.map((line) => {
      const row = line as Record<string, unknown>
      return {
        formDate: String(row.form_date ?? ''),
        orderCode: row.order_code != null ? String(row.order_code) : null,
        orderName: row.order_name != null ? String(row.order_name) : null,
        performanceHours: toNumber(row.performance_hours),
        manualDigBm: toNumber(row.manual_dig_bm),
        penetrationKs: toNumber(row.penetration_ks),
        dailyAdvance: toNumber(row.daily_advance),
        note: row.note != null ? String(row.note) : '',
        confidence: toNumber(row.ai_confidence),
      }
    }),
    summary: {
      totalHours: toNumber((payload.summary as Record<string, unknown>)?.total_hours),
      totalBm: toNumber((payload.summary as Record<string, unknown>)?.total_bm),
      totalPenetrations: toNumber((payload.summary as Record<string, unknown>)?.total_penetrations),
      totalAdvance: toNumber((payload.summary as Record<string, unknown>)?.total_advance),
    },
    overallConfidence: toNumber(payload.overall_confidence),
    aiModel: typeof payload.ai_model === 'string' ? payload.ai_model : null,
    storagePath: null,
  }
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function extractFormCheckFromImage(
  request: FormCheckOcrRequest
): Promise<FormCheckOcrResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Nejste přihlášeni')

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Nepodařilo se načíst fotografii'))
        return
      }
      resolve(result.replace(/^data:[^;]+;base64,/, ''))
    }
    reader.onerror = () => reject(new Error('Nepodařilo se načíst fotografii'))
    reader.readAsDataURL(request.file)
  })

  const res = await fetch('/api/ai-form-check-extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      image_base64: base64,
      mime_type: request.file.type || 'image/jpeg',
      order_legend: request.orderLegend,
      month: request.month,
      year: request.year,
      worker_name: request.workerName ?? '',
      form_number: request.formNumber,
    }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error ?? 'OCR rozpoznání se nezdařilo')
  }

  return normalizeOcrResult(payload as Record<string, unknown>)
}
