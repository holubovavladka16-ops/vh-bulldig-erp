import type { JobOrder } from '@/types/orders'

/** Sestaví dotaz pro geokódování z údajů zakázky (město i úplná adresa). */
export function buildGeocodeQueryFromOrder(order: Pick<JobOrder, 'location' | 'name'>): string | null {
  const location = order.location?.trim()
  if (!location) return null

  const normalized = location.toLowerCase()
  if (normalized.includes('česko') || normalized.includes('czech')) {
    return location
  }

  return `${location}, Česko`
}

/** Krátké zpoždění mezi požadavky (Nominatim max 1 req/s). */
export const GEOCODE_RATE_LIMIT_MS = 1100

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
