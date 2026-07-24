import { polishTextWithAi, type AiPolishContext, type AiPolishOptions } from '@/lib/ai/geminiPolish'

export interface DiaryAiPolishResult {
  polished_text: string
  ai_assisted: boolean
}

/** @deprecated Použijte polishTextWithAi z @/lib/ai/geminiPolish */
export async function polishDiaryWorkDescription(roughText: string): Promise<DiaryAiPolishResult> {
  return polishTextWithAi(roughText, 'diary')
}

export { polishTextWithAi, type AiPolishContext, type AiPolishOptions }
