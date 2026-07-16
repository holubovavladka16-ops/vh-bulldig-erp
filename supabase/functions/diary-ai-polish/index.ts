import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? ""
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash"

const PROMPTS: Record<string, string> = {
  diary: `Jsi odborník na stavební deníky. Přepiš následující text do profesionální podoby vhodné pro stavební deník.
Oprav pravopis, gramatiku, diakritiku a stylistiku. Používej správnou stavební terminologii.
Zachovej všechny skutečné informace, nic nevymýšlej ani nepřidávej.
Výstup napiš spisovnou češtinou. Vrať pouze upravený text bez úvodu, komentáře a bez uvozovek.`,
  daily_form: `Jsi odborník na denní výkazy stavebních dělníků. Přepiš následující text do profesionální češtiny.
Oprav pravopis, gramatiku, diakritiku a stylistiku. Používej správnou stavební terminologii.
Zachovej všechny skutečné informace, nic nevymýšlej ani nepřidávej.
Výstup napiš spisovnou češtinou. Vrať pouze upravený text bez úvodu, komentáře a bez uvozovek.`,
}

interface PolishPayload {
  rough_text?: string
  context?: string
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { message?: string }
}

async function polishWithGemini(roughText: string, context: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY není nastaven v Supabase Secrets")
  }

  const prompt = PROMPTS[context] ?? PROMPTS.daily_form
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: roughText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(45000),
  })

  const data = (await res.json()) as GeminiResponse

  if (!res.ok) {
    const msg = data.error?.message ?? `Gemini HTTP ${res.status}`
    throw new Error(msg)
  }

  const polished = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!polished) {
    throw new Error("Gemini nevrátil žádný text")
  }

  return polished.replace(/^["'„«]+|["'»]+$/g, "").trim()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    const portalToken = req.headers.get("X-Portal-Token")

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

    let authorized = false

    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
      } = await userClient.auth.getUser()
      authorized = !!user
    }

    if (!authorized && portalToken) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/portal_get_worker`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_token: portalToken }),
      })
      if (res.ok) {
        const data = await res.json()
        authorized = !!data && typeof data === "object"
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Chybí Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as PolishPayload
    const roughText = body.rough_text?.trim() ?? ""
    const context = body.context === "diary" ? "diary" : "daily_form"

    if (roughText.length < 8) {
      return new Response(JSON.stringify({ error: "Text je příliš krátký pro úpravu AI" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (roughText.length > 8000) {
      return new Response(JSON.stringify({ error: "Text je příliš dlouhý (max. 8000 znaků)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const polished_text = await polishWithGemini(roughText, context)

    return new Response(JSON.stringify({ polished_text, ai_assisted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
