import type { JobOrderStatus } from '@/types/orders'

export const JOB_ORDER_STATUS_LABELS: Record<JobOrderStatus, string> = {
  pripravuje_se: 'Připravuje se',
  aktivni: 'Aktivní',
  pozastavena: 'Pozastavená',
  dokoncena: 'Dokončená',
  archivovana: 'Archivovaná',
}

export const JOB_ORDER_STATUS_OPTIONS = (Object.keys(JOB_ORDER_STATUS_LABELS) as JobOrderStatus[]).map(
  (value) => ({ value, label: JOB_ORDER_STATUS_LABELS[value] })
)
