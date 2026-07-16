import { supabase } from '@/lib/supabase'

export type AiPolishContext = 'diary' | 'daily_form'

export interface AiPolishResult {
  polished_text: string
  ai_assisted: boolean
}

export interface AiPolishOptions {
  portalToken?: string
}

function translateAiError(message: string | undefined, status: number): string {
  if (status === 503 || message?.includes('GEMINI_API_KEY')) {
    return 'AI asistent není dostupný. Služba Gemini není nakonfigurována.'
  }
  if (status === 401) {
    return 'Pro použití AI asistenta se musíte přihlásit.'
  }
  if (status === 400 && message) {
    return message
  }
  if (status === 504) {
    return 'AI asistent neodpověděl včas. Zkuste to prosím znovu.'
  }
  return message || 'Oprava textu pomocí AI se nezdařila. Zkuste to později nebo text upravte ručně.'
}

export async function polishTextWithAi(
  roughText: string,
  context: AiPolishContext,
  options: AiPolishOptions = {}
): Promise<AiPolishResult> {
  const trimmed = roughText.trim()
  if (trimmed.length < 8) {
    throw new Error('Napište alespoň krátký popis práce pro úpravu AI.')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  } else if (options.portalToken) {
    headers['X-Portal-Token'] = options.portalToken
  } else {
    throw new Error('Pro použití AI asistenta se musíte přihlásit.')
  }

  let response: Response
  try {
    response = await fetch('/api/ai-polish-text', {
      method: 'POST',
      headers,
      body: JSON.stringify({ rough_text: trimmed, context }),
    })
  } catch {
    throw new Error('AI asistent není dostupný. Zkontrolujte připojení k internetu.')
  }

  let data: { polished_text?: string; error?: string; ai_assisted?: boolean }
  try {
    data = (await response.json()) as typeof data
  } catch {
    throw new Error('AI asistent není dostupný. Neočekávaná odpověď serveru.')
  }

  if (!response.ok) {
    const shouldTrySupabaseFallback =
      (accessToken || options.portalToken) &&
      (response.status === 503 || response.status === 404 || response.status >= 500)

    if (shouldTrySupabaseFallback) {
      try {
        const fallbackHeaders: Record<string, string> = {}
        if (!accessToken && options.portalToken) {
          fallbackHeaders['X-Portal-Token'] = options.portalToken
        }
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('diary-ai-polish', {
          body: { rough_text: trimmed, context },
          headers: fallbackHeaders,
        })
        if (!edgeError && edgeData?.polished_text?.trim()) {
          return {
            polished_text: edgeData.polished_text.trim(),
            ai_assisted: edgeData.ai_assisted ?? true,
          }
        }
      } catch {
        // pokračuj s původní chybou
      }
    }

    throw new Error(translateAiError(data.error, response.status))
  }

  if (!data.polished_text?.trim()) {
    throw new Error('AI nevrátila upravený text.')
  }

  return {
    polished_text: data.polished_text.trim(),
    ai_assisted: data.ai_assisted ?? true,
  }
}
