import { EMPLOYMENT_TYPE_LABELS } from '@/constants/workers'
import { formatDate } from '@/constants/workers'
import type { Worker } from '@/types/workers'
import type { PaperMonthlyForm, PaperWorkerSnapshot } from '@/types/paperForms'

const PDF_FIELD_LABELS: Record<keyof Omit<PaperWorkerSnapshot, 'phone' | 'birth_number'>, string> = {
  first_name: 'Jméno',
  last_name: 'Příjmení',
  birth_date: 'Datum narození',
  address: 'Adresa',
  start_date: 'Datum nástupu',
  position: 'Pozice',
  employment_type: 'Pracovní poměr',
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

export function buildWorkerSnapshotFromWorker(worker: Worker): PaperWorkerSnapshot {
  return {
    first_name: worker.first_name?.trim() ?? '',
    last_name: worker.last_name?.trim() ?? '',
    address: worker.address?.trim() ?? '',
    birth_date: worker.birth_date ?? '',
    start_date: worker.start_date ?? '',
    position: worker.position?.trim() ?? '',
    employment_type: worker.employment_type ?? '',
    phone: worker.phone ?? null,
    birth_number: worker.birth_number ?? null,
  }
}

export function normalizePaperWorkerSnapshot(raw: unknown): PaperWorkerSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  return {
    first_name: String(row.first_name ?? '').trim(),
    last_name: String(row.last_name ?? '').trim(),
    address: String(row.address ?? '').trim(),
    birth_date: String(row.birth_date ?? '').trim(),
    start_date: String(row.start_date ?? '').trim(),
    position: String(row.position ?? '').trim(),
    employment_type: String(row.employment_type ?? '').trim(),
    phone: row.phone != null ? String(row.phone) : null,
    birth_number: row.birth_number != null ? String(row.birth_number) : null,
  }
}

export interface WorkerSnapshotValidation {
  ok: boolean
  missingRequired: string[]
  missingOptional: string[]
}

export function validateWorkerSnapshotForPdf(snapshot: PaperWorkerSnapshot | null | undefined): WorkerSnapshotValidation {
  const snap = snapshot ?? null
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  if (!hasText(snap?.first_name)) missingRequired.push(PDF_FIELD_LABELS.first_name)
  if (!hasText(snap?.last_name)) missingRequired.push(PDF_FIELD_LABELS.last_name)

  if (!hasText(snap?.birth_date)) missingOptional.push(PDF_FIELD_LABELS.birth_date)
  if (!hasText(snap?.address)) missingOptional.push(PDF_FIELD_LABELS.address)
  if (!hasText(snap?.start_date)) missingOptional.push(PDF_FIELD_LABELS.start_date)
  if (!hasText(snap?.position)) missingOptional.push(PDF_FIELD_LABELS.position)
  if (!hasText(snap?.employment_type)) missingOptional.push(PDF_FIELD_LABELS.employment_type)

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  }
}

export function validateWorkerForPdf(worker: Worker): WorkerSnapshotValidation {
  return validateWorkerSnapshotForPdf(buildWorkerSnapshotFromWorker(worker))
}

export function formatWorkerSnapshotWarningMessage(validation: WorkerSnapshotValidation): string {
  const parts: string[] = []
  if (validation.missingRequired.length > 0) {
    parts.push(`Chybí povinné údaje: ${validation.missingRequired.join(', ')}.`)
  }
  if (validation.missingOptional.length > 0) {
    parts.push(`Chybí volitelné údaje: ${validation.missingOptional.join(', ')}.`)
  }
  return parts.join(' ')
}

export function confirmWorkerSnapshotWarnings(validation: WorkerSnapshotValidation): boolean {
  if (!validation.ok) return false
  if (validation.missingOptional.length === 0) return true
  return window.confirm(
    `${formatWorkerSnapshotWarningMessage(validation)}\n\nPřesto pokračovat k tisku?`
  )
}

export function formatSnapshotDate(value: string | null | undefined): string {
  if (!hasText(value)) return ''
  try {
    return formatDate(value!)
  } catch {
    return value!.trim()
  }
}

export function formatSnapshotEmploymentType(value: string | null | undefined): string {
  if (!hasText(value)) return ''
  const key = value as keyof typeof EMPLOYMENT_TYPE_LABELS
  return EMPLOYMENT_TYPE_LABELS[key] ?? value!.trim()
}

export function getWorkerFirstPdfHeaderRows(
  snapshot: PaperWorkerSnapshot,
  month: number,
  year: number,
  monthNames: readonly string[]
): Array<[string, string]> {
  return [
    ['Jméno', snapshot.first_name],
    ['Příjmení', snapshot.last_name],
    ['Datum narození', formatSnapshotDate(snapshot.birth_date)],
    ['Adresa', snapshot.address],
    ['Datum nástupu', formatSnapshotDate(snapshot.start_date)],
    ['Pozice', snapshot.position],
    ['Pracovní poměr', formatSnapshotEmploymentType(snapshot.employment_type)],
    ['Měsíc', monthNames[month - 1] ?? String(month)],
    ['Rok', String(year)],
  ]
}

export function isWorkerFirstVariant(form: Pick<PaperMonthlyForm, 'form_variant'>): boolean {
  return (form.form_variant ?? 'worker_first') === 'worker_first'
}

export function snapshotHasRequiredNames(snapshot: PaperWorkerSnapshot | null | undefined): boolean {
  return hasText(snapshot?.first_name) && hasText(snapshot?.last_name)
}
