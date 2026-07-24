import type { JobOrderStatus } from '@/types/orders'

/** Barva badge stavu zakázky – nesmí být zaměňována s barvou markeru na mapě. */
export function getOrderStatusBadgeVariant(
  status: JobOrderStatus
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'pripravuje_se':
      return 'warning'
    case 'pozastavena':
      return 'danger'
    case 'dokoncena':
      return 'info'
    case 'archivovana':
      return 'neutral'
    case 'aktivni':
    default:
      return 'info'
  }
}
