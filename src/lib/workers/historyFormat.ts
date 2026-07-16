import { WORKER_STATUS_LABELS } from '@/constants/workers'
import type { WorkerHistoryEntry, WorkerStatus } from '@/types/workers'

function isWorkerStatus(value: unknown): value is WorkerStatus {
  return typeof value === 'string' && value in WORKER_STATUS_LABELS
}

export function formatHistoryAction(action: string): string {
  const match = action.match(/^Stav změněn na (\w+)$/)
  if (match && isWorkerStatus(match[1])) {
    return `Stav změněn na ${WORKER_STATUS_LABELS[match[1]]}`
  }
  return action
}

export function formatHistoryDetails(entry: WorkerHistoryEntry): string {
  const details = entry.details ?? {}
  const keys = Object.keys(details)
  if (keys.length === 0) return '—'

  const parts: string[] = []

  if (typeof details.status === 'string' && isWorkerStatus(details.status)) {
    parts.push(`Nový stav: ${WORKER_STATUS_LABELS[details.status]}`)
  }

  if (typeof details.form_id === 'string') {
    parts.push('Související formulář')
  }

  if (typeof details.note === 'string' && details.note.trim()) {
    parts.push(details.note.trim())
  }

  if (typeof details.reason === 'string' && details.reason.trim()) {
    parts.push(details.reason.trim())
  }

  if (parts.length > 0) return parts.join(' · ')

  return keys
    .map((key) => {
      const value = details[key]
      if (value == null || value === '') return null
      return `${key}: ${String(value)}`
    })
    .filter(Boolean)
    .join(' · ') || '—'
}
