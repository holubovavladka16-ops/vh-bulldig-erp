import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/constants/workers'
import type { EmploymentType, Worker } from '@/types/workers'
import type { PaperWorkerSnapshot } from '@/types/paperForms'

export function buildWorkerSnapshot(worker: Worker): PaperWorkerSnapshot {
  return {
    first_name: worker.first_name,
    last_name: worker.last_name,
    address: worker.address ?? '',
    birth_date: worker.birth_date,
    start_date: worker.start_date,
    position: worker.position ?? '',
    employment_type: worker.employment_type,
    phone: worker.phone,
    birth_number: worker.birth_number,
  }
}

export function formatSnapshotDate(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return formatDate(value)
}

export function formatSnapshotEmploymentType(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return EMPLOYMENT_TYPE_LABELS[value as EmploymentType] ?? value
}

export interface WorkerFormPreviewRow {
  label: string
  value: string
}

export function buildWorkerFormPreviewRows(
  worker: Worker | null,
  monthLabel: string,
  year: number
): WorkerFormPreviewRow[] {
  if (!worker) return []

  return [
    { label: 'Jméno', value: worker.first_name },
    { label: 'Příjmení', value: worker.last_name },
    { label: 'Datum narození', value: formatSnapshotDate(worker.birth_date) },
    { label: 'Adresa', value: worker.address ?? '' },
    { label: 'Datum nástupu', value: formatSnapshotDate(worker.start_date) },
    { label: 'Pozice', value: worker.position ?? '' },
    { label: 'Pracovní poměr', value: formatSnapshotEmploymentType(worker.employment_type) },
    { label: 'Měsíc', value: monthLabel },
    { label: 'Rok', value: String(year) },
  ]
}
