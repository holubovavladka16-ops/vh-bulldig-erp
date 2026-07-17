import { supabase } from '@/lib/supabase'
import { formatPaperPeriod } from '@/constants/paperForms'
import type { FormCheckContext, FormCheckError } from '@/types/formCheck'
import type { PaperFormResolved, PaperMonthlyForm } from '@/types/paperForms'

const QR_FORM_ID_PATTERN = /^(PMF-[A-Z0-9]{4,12}|PM-\d{4}-\d{3,6})$/i

export function isValidQrFormIdPayload(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  return QR_FORM_ID_PATTERN.test(trimmed)
}

export function normalizeQrPayload(raw: string): string {
  return raw.trim()
}

function mapFormRowToContext(row: PaperMonthlyForm): FormCheckContext {
  const workerName = row.worker_snapshot
    ? `${row.worker_snapshot.last_name} ${row.worker_snapshot.first_name}`
    : null

  return {
    formId: row.id,
    publicId: row.public_id,
    formNumber: row.form_number,
    workerId: row.worker_id,
    workerName,
    month: row.month,
    year: row.year,
    periodLabel: formatPaperPeriod(row.month, row.year),
    status: row.status,
    needsWorkerAssignment: row.worker_id === null,
  }
}

export function buildFormCheckError(
  code: FormCheckError['code'],
  message: string
): FormCheckError {
  return { code, message }
}

/**
 * Načte formulář z databáze podle čísla formuláře (form_number).
 */
export async function fetchFormByFormNumber(
  formNumber: string
): Promise<{ context: FormCheckContext } | { error: FormCheckError }> {
  const normalized = formNumber.trim()

  if (!normalized) {
    return {
      error: buildFormCheckError('form_not_found', 'Chybí číslo formuláře.'),
    }
  }

  try {
    const { data, error } = await supabase
      .from('paper_monthly_forms')
      .select('*')
      .ilike('form_number', normalized)
      .maybeSingle()

    if (error) {
      return {
        error: buildFormCheckError(
          'resolve_failed',
          error.message || 'Nepodařilo se načíst formulář z databáze.'
        ),
      }
    }

    if (!data) {
      return {
        error: buildFormCheckError(
          'form_not_found',
          `Formulář „${normalized}" nebyl nalezen v databázi.`
        ),
      }
    }

    const context = mapFormRowToContext(data as PaperMonthlyForm)

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

/**
 * Vyhledá formulář podle obsahu QR kódu (public_id nebo form_number),
 * poté načte aktuální data z databáze podle form_number.
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

    const dbResult = await fetchFormByFormNumber(resolved.form_number)
    if ('error' in dbResult) {
      return dbResult
    }

    return dbResult
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