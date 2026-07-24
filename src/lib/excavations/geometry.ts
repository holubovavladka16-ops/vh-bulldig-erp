import type { ExcavationPoint } from '@/types/excavations'

const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Vzdálenost mezi dvěma GPS body (Haversine) v metrech. */
export function distanceMeters(a: ExcavationPoint, b: ExcavationPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Celková délka polyline podle GPS bodů v metrech. */
export function calculateRouteLengthMeters(points: ExcavationPoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1], points[i])
  }
  return total
}

export interface RouteSegment {
  fromIndex: number
  toIndex: number
  meters: number
}

/** Délky jednotlivých úseků trasy (bod → bod). */
export function getRouteSegments(points: ExcavationPoint[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  for (let i = 1; i < points.length; i++) {
    segments.push({
      fromIndex: i - 1,
      toIndex: i,
      meters: distanceMeters(points[i - 1], points[i]),
    })
  }
  return segments
}

export function formatSegmentLength(meters: number): string {
  return meters.toLocaleString('cs-CZ', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })
}

export function formatRouteLength(meters: number): string {
  if (meters < 1000) {
    return `${meters.toLocaleString('cs-CZ', { maximumFractionDigits: 1, minimumFractionDigits: meters < 10 ? 1 : 0 })} m`
  }
  return `${(meters / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} km`
}

export function parseExcavationPoints(raw: unknown): ExcavationPoint[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const p = item as Record<string, unknown>
      const lat = Number(p.lat)
      const lng = Number(p.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      const point: ExcavationPoint = { lat, lng }
      const accuracy = Number(p.accuracy)
      if (Number.isFinite(accuracy) && accuracy > 0) point.accuracy = accuracy
      if (typeof p.label === 'string' && p.label.trim()) point.label = p.label.trim()
      return point
    })
    .filter((p): p is ExcavationPoint => p != null)
}

export function formatGpsAccuracy(accuracy?: number): string {
  if (accuracy == null) return '—'
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
}

export function formatGpsCoordinates(point: ExcavationPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
}

export function getRouteMapUrl(points: ExcavationPoint[]): string {
  if (points.length === 0) return 'https://www.openstreetmap.org/'
  const center = points[Math.floor(points.length / 2)]
  return `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=18/${center.lat}/${center.lng}`
}
