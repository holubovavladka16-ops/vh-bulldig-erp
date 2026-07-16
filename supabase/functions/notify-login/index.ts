import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const NOTIFY_EMAIL = Deno.env.get("LOGIN_NOTIFY_EMAIL") ?? "holubovavladka16@gmail.com"
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "VH Bulldig ERP <onboarding@resend.dev>"

interface LoginPayload {
  user_email?: string
  user_name?: string
  user_agent?: string
  device?: string
  browser?: string
  os?: string
  device_type?: string
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? ""
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? ""
}

async function lookupLocation(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("::1") || ip.startsWith("192.168.")) {
    return "Lokální síť / neznámá poloha"
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country&lang=cs`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return "Poloha nedostupná"
    const data = (await res.json()) as {
      status?: string
      city?: string
      regionName?: string
      country?: string
    }
    if (data.status !== "success") return "Poloha nedostupná"
    return [data.city, data.regionName, data.country].filter(Boolean).join(", ") || "Poloha nedostupná"
  } catch {
    return "Poloha nedostupná"
  }
}

function formatPragueTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso)
  return {
    date: new Intl.DateTimeFormat("cs-CZ", {
      timeZone: "Europe/Prague",
      dateStyle: "long",
    }).format(dt),
    time: new Intl.DateTimeFormat("cs-CZ", {
      timeZone: "Europe/Prague",
      timeStyle: "medium",
    }).format(dt),
  }
}

function deviceTypeLabel(value: string | undefined): string {
  if (value === "mobile") return "Mobil"
  if (value === "desktop") return "PC"
  return "Neznámé"
}

function buildEmailHtml(params: {
  userEmail: string
  userName: string
  loginTime: string
  ip: string
  device: string
  browser: string
  os: string
  location: string
  deviceType: string
  userAgent: string
}): string {
  const { date, time } = formatPragueTime(params.loginTime)
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Nové přihlášení do aplikace VH Bulldig ERP</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#555">E-mail uživatele</td><td><strong>${params.userEmail}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#555">Jméno</td><td>${params.userName || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Datum</td><td>${date}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Čas</td><td>${time}</td></tr>
        <tr><td style="padding:6px 0;color:#555">IP adresa</td><td>${params.ip || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Zařízení</td><td>${params.device || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Prohlížeč</td><td>${params.browser || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Operační systém</td><td>${params.os || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Poloha (IP)</td><td>${params.location || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#555">Typ zařízení</td><td>${deviceTypeLabel(params.deviceType)}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#666">User-Agent: ${params.userAgent || "—"}</p>
    </div>
  `
}

async function sendAdminEmail(html: string): Promise<{ ok: boolean; error?: string }> {
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
        to: [NOTIFY_EMAIL],
        subject: "Nové přihlášení do aplikace VH Bulldig ERP",
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Resend HTTP ${res.status}: ${body.slice(0, 300)}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Resend selhal" }
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

    const body = (await req.json()) as LoginPayload
    const ip = getClientIp(req)
    const location = await lookupLocation(ip)
    const loginTime = new Date().toISOString()

    const userEmail = body.user_email?.trim() || user.email || ""
    const userName = body.user_name?.trim() || user.user_metadata?.full_name || ""
    const deviceType = ["mobile", "desktop"].includes(body.device_type ?? "")
      ? body.device_type!
      : "unknown"

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const emailHtml = buildEmailHtml({
      userEmail,
      userName,
      loginTime,
      ip,
      device: body.device ?? "",
      browser: body.browser ?? "",
      os: body.os ?? "",
      location,
      deviceType,
      userAgent: body.user_agent ?? "",
    })

    const emailResult = await sendAdminEmail(emailHtml)

    const { data: logRow, error: logError } = await adminClient
      .from("login_logs")
      .insert({
        user_id: user.id,
        user_email: userEmail,
        user_name: userName || null,
        login_time: loginTime,
        ip_address: ip || null,
        device: body.device ?? null,
        browser: body.browser ?? null,
        os: body.os ?? null,
        location,
        user_agent: body.user_agent ?? null,
        device_type: deviceType,
        email_sent: emailResult.ok,
        email_error: emailResult.error ?? null,
      })
      .select("id")
      .single()

    if (logError) {
      return new Response(JSON.stringify({ error: logError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        log_id: logRow?.id,
        email_sent: emailResult.ok,
        email_error: emailResult.error ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
