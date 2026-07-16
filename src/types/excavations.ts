export type MeasurementMode = 'manual' | 'gps_walk' | 'address_route'

export const MEASUREMENT_MODE_LABELS: Record<MeasurementMode, string> = {
  manual: 'Ruční kreslení',
  gps_walk: 'Měření chůzí (GPS)',
  address_route: 'Měření podle adresy',
}

export interface ExcavationPoint {
  lat: number
  lng: number
  /** Přesnost GPS v metrech (režim chůze). */
  accuracy?: number
  /** Popisek bodu (adresa nebo štítek). */
  label?: string
}

export interface ExcavationRoute {
  id: string
  order_id: string
  name: string
  note: string | null
  color: string
  points: ExcavationPoint[]
  total_length_m: number
  created_by: string | null
  created_at: string
  updated_at: string
  order_name?: string
  creator_name?: string
}

export interface ExcavationRouteCreateInput {
  order_id: string
  name: string
  note?: string
  color: string
  points: ExcavationPoint[]
  total_length_m: number
}

export interface ExcavationRouteFilters {
  orderId?: string
}

export const EXCAVATION_ROUTE_COLORS = [
  '#06b6d4',
  '#a3e635',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#3b82f6',
] as const

export function pickRouteColor(index: number): string {
  return EXCAVATION_ROUTE_COLORS[index % EXCAVATION_ROUTE_COLORS.length]
}
