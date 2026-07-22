import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "VH Bulldig <onboarding@resend.dev>"

interface SendInvoicePayload {
  invoice_id?: string
  to_email: string
  subject?: string
  message?: string
  pdf_base64: string
  pdf_filename?: string
}

async function sendEmailWithAttachment(params: {
  to: string
  subject: string
  html: string
  pdfBase64: string
  pdfFilename: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY není nastaven v Supabase Secrets" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        attachments: [
          {
            filename: params.pdfFilename,
            content: params.pdfBase64,
          },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Resend HTTP ${res.status}: ${body.slice(0, 400)}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Odeslání e-mailu selhalo" }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Chybí Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Neplatná session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: role, error: roleError } = await userClient.rpc("get_user_role")
    if (roleError || role !== "administrator") {
      return new Response(JSON.stringify({ error: "Pouze administrátor může odesílat faktury" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as SendInvoicePayload
    const toEmail = body.to_email?.trim()
    const pdfBase64 = body.pdf_base64?.trim()

    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return new Response(JSON.stringify({ error: "Neplatný e-mail příjemce" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!pdfBase64 || pdfBase64.length < 100) {
      return new Response(JSON.stringify({ error: "Chybí PDF příloha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const subject = body.subject?.trim() || "Faktura – VH Bulldig s.r.o."
    const pdfFilename = body.pdf_filename?.trim() || "faktura.pdf"
    const html =
      body.message?.trim() ||
      `<p>Dobrý den,</p><p>v příloze zasíláme fakturu.</p><p>S pozdravem<br/>VH Bulldig s.r.o.</p>`

    const emailResult = await sendEmailWithAttachment({
      to: toEmail,
      subject,
      html: html.includes("<") ? html : `<p>${html.replace(/\n/g, "<br/>")}</p>`,
      pdfBase64,
      pdfFilename,
    })

    if (!emailResult.ok) {
      return new Response(JSON.stringify({ error: emailResult.error ?? "E-mail se neodeslal" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.invoice_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      await adminClient
        .from("issued_invoices")
        .update({
          status: "odeslana",
          sent_at: new Date().toISOString(),
          sent_to_email: toEmail,
        })
        .eq("id", body.invoice_id)
    }

    return new Response(JSON.stringify({ ok: true, sent_to: toEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
