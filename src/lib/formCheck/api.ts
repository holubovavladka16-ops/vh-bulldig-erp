import { supabase } from '@/lib/supabase'
import { formatPaperPeriod } from '@/constants/paperForms'
import type { FormCheckContext, FormCheckError } from '@/types/formCheck'
import type { PaperFormResolved } from '@/types/paperForms'

const QR_FORM_ID_PATTERN = /^(PMF-[A-Z0-9]{4,12}|PM-\d{4}-\d{3,6})$/i

export function isValidQrFormIdPayload(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  return QR_FORM_ID_PATTERN.test(trimmed)
}

export function normalizeQrPayload(raw: string): string {
  return raw.trim()
}

function mapResolvedToContext(resolved: PaperFormResolved): FormCheckContext {
  return {
    formId: resolved.id,
    publicId: resolved.public_id,
    formNumber: resolved.form_number,
    workerId: resolved.worker_id,
    workerName: resolved.worker_name,
    month: resolved.month,
    year: resolved.year,
    periodLabel: formatPaperPeriod(resolved.month, resolved.year),
    status: resolved.status,
    needsWorkerAssignment: Boolean(resolved.needs_worker_assignment),
  }
}

export function buildFormCheckError(
  code: FormCheckError['code'],
  message: string
): FormCheckError {
  return { code, message }
}

/**
 * Vyhledá formulář podle obsahu QR kódu (public_id nebo form_number).
 * Nevyhazuje výjimku – vrací buď kontext, nebo chybu.
 */
export async function resolveFormByQrPayload(
  rawPayload: string
): Promise<{ context: FormCheckContext } | { error: FormCheckError }> {
  const payload = normalizeQrPayload(rawPayload)

  if (!payload) {
    return {
      error: buildFormCheckError(
        'invalid_qr',
        'QR kód je prázdný. Naskenujte kód z papírového formuláře.'
      ),
    }
  }

  if (!isValidQrFormIdPayload(payload)) {
    return {
      error: buildFormCheckError(
        'invalid_qr',
        'QR kód není platný. Očekává se identifikátor formuláře ve formátu PM-2026-00001 nebo PMF-XXXXXXXX.'
      ),
    }
  }

  try {
    const { data, error } = await supabase.rpc('resolve_paper_form_public_id', {
      p_public_id: payload,
    })

    if (error) {
      return {
        error: buildFormCheckError(
          'resolve_failed',
          error.message || 'Nepodařilo se ověřit formulář. Zkuste to prosím znovu.'
        ),
      }
    }

    const rows = (data ?? []) as PaperFormResolved[]
    const resolved = rows[0]

    if (!resolved) {
      return {
        error: buildFormCheckError(
          'form_not_found',
          `Formulář „${payload}" nebyl nalezen. Ověřte, že QR kód odpovídá existujícímu formuláři v systému.`
        ),
      }
    }

    const context = mapResolvedToContext(resolved)

    if (context.needsWorkerAssignment || !context.workerId || !context.workerName) {
      return {
        error: buildFormCheckError(
          'no_worker',
          'Formulář nemá přiřazeného zaměstnance. Nejprve přiřaďte zaměstnance v modulu Papírové měsíční výkazy.'
        ),
      }
    }

    return { context }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Neočekávaná chyba při načítání formuláře. Zkuste to prosím znovu.'
    return {
      error: buildFormCheckError('unknown', message),
    }
  }
}
