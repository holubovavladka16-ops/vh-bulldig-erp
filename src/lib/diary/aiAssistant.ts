import { supabase } from '@/lib/supabase'

export interface DiaryAiPolishResult {
  polished_text: string
  ai_assisted: boolean
}

export async function polishDiaryWorkDescription(roughText: string): Promise<DiaryAiPolishResult> {
  const trimmed = roughText.trim()
  if (trimmed.length < 8) {
    throw new Error('Napište alespoň krátký popis práce pro úpravu AI.')
  }

  const { data, error } = await supabase.functions.invoke('diary-ai-polish', {
    body: { rough_text: trimmed },
  })

  if (error) {
    throw new Error(error.message || 'AI asistent není dostupný')
  }

  const result = data as { polished_text?: string; error?: string; ai_assisted?: boolean }
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.polished_text?.trim()) {
    throw new Error('AI nevrátila upravený text')
  }

  return {
    polished_text: result.polished_text.trim(),
    ai_assisted: result.ai_assisted ?? true,
  }
}
