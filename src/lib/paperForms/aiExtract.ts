import { supabase } from '@/lib/supabase'
import type { PaperFormAiLine } from '@/types/paperForms'

export interface PaperFormAiExtractResult {
  lines: PaperFormAiLine[]
  summary: Record<string, unknown>
  overall_confidence?: number
  ai_model?: string
}

export async function extractPaperFormFromImage(
  file: File,
  orderLegend: unknown[],
  month: number,
  year: number
): Promise<PaperFormAiExtractResult> {
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
    reader.readAsDataURL(file)
  })

  const res = await fetch('/api/ai-paper-form-extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      image_base64: base64,
      mime_type: file.type || 'image/jpeg',
      order_legend: orderLegend,
      month,
      year,
    }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error ?? 'AI import se nezdařil')
  }

  return {
    lines: (payload.lines ?? []) as PaperFormAiLine[],
    summary: (payload.summary ?? {}) as Record<string, unknown>,
    overall_confidence: payload.overall_confidence,
    ai_model: payload.ai_model,
  }
}
