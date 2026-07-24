import { forwardGeocode } from '@/lib/photos/geocoding'
import { supabase } from '@/lib/supabase'
import { buildGeocodeQueryFromOrder, delay, GEOCODE_RATE_LIMIT_MS } from '@/lib/zakazkyMapa/geocodeQuery'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'
import { recalculateProjectMarkerColor } from '@/lib/zakazkyMapa/recalculateMarkerColor'
import {
  PROJECT_MARKER_DEFAULT_COLOR,
  PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
  PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M,
  PROJECT_MARKER_GEOCODE_APPROXIMATE,
  PROJECT_MARKER_NEW_ORDER_LABEL,
} from '@/constants/zakazkyMapa'
import type { ProjectMapMarkerInsert } from '@/types/zakazkyMapa'
import type { JobOrder } from '@/types/orders'

export interface ProjectMarkerGpsInput {
  gps_lat?: number | null
  gps_lng?: number | null
  gps_accuracy?: number | null
  location?: string
}

export interface ProjectMarkerGpsResult {
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  is_approximate: boolean
}

export interface EnsureMarkerResult {
  projectId: string
  hasGps: boolean
  geocoded: boolean
  created: boolean
  updated: boolean
  error?: string
}

function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
}

/** Priorita: GPS ze zakázky → geokódování místa → bez souřadnic (neúplný špendlík). */
export function resolveMarkerGpsFromOrderFields(input: ProjectMarkerGpsInput): ProjectMarkerGpsResult | 'geocode' {
  if (hasValidCoordinates(input.gps_lat, input.gps_lng)) {
    const accuracy = input.gps_accuracy ?? null
    const isApproximate =
      accuracy == null || accuracy > PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M
    return {
      gps_lat: input.gps_lat!,
      gps_lng: input.gps_lng!,
      gps_accuracy: accuracy,
      is_approximate: isApproximate,
    }
  }

  if (input.location?.trim()) {
    return 'geocode'
  }

  return {
    gps_lat: null,
    gps_lng: null,
    gps_accuracy: null,
    is_approximate: true,
  }
}

export async function resolveProjectMarkerGps(
  input: ProjectMarkerGpsInput
): Promise<ProjectMarkerGpsResult> {
  const resolved = resolveMarkerGpsFromOrderFields(input)
  if (resolved !== 'geocode') {
    return resolved
  }

  const query = input.location?.trim()
  if (!query) {
    return {
      gps_lat: null,
      gps_lng: null,
      gps_accuracy: null,
      is_approximate: true,
    }
  }

  try {
    const geocoded = await forwardGeocode(query)
    if (geocoded) {
      return {
        gps_lat: geocoded.lat,
        gps_lng: geocoded.lng,
        gps_accuracy: null,
        is_approximate: PROJECT_MARKER_GEOCODE_APPROXIMATE,
      }
    }
  } catch {
    // Geokódování nesmí přerušit vytvoření zakázky.
  }

  return {
    gps_lat: null,
    gps_lng: null,
    gps_accuracy: null,
    is_approximate: true,
  }
}

export function buildProjectMapMarkerInsert(
  projectId: string,
  gps: ProjectMarkerGpsResult
): ProjectMapMarkerInsert {
  return {
    project_id: projectId,
    gps_lat: gps.gps_lat,
    gps_lng: gps.gps_lng,
    gps_accuracy: gps.gps_accuracy,
    is_approximate: gps.is_approximate,
    marker_color: PROJECT_MARKER_DEFAULT_COLOR,
    color_source: PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
    color_label: PROJECT_MARKER_NEW_ORDER_LABEL,
  }
}

async function fetchProjectMapMarker(projectId: string): Promise<{
  gps_lat: number | null
  gps_lng: number | null
} | null> {
  const { data, error } = await supabase
    .from('project_map_markers')
    .select('gps_lat, gps_lng')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as { gps_lat: number | null; gps_lng: number | null } | null
}

function orderLocationFields(order: JobOrder): ProjectMarkerGpsInput {
  const geocodeQuery = buildGeocodeQueryFromOrder(order)
  return {
    gps_lat: order.gps_lat,
    gps_lng: order.gps_lng,
    gps_accuracy: order.gps_accuracy,
    location: geocodeQuery ?? order.location,
  }
}

function markerNeedsGpsUpdate(
  marker: { gps_lat: number | null; gps_lng: number | null },
  gps: ProjectMarkerGpsResult
): boolean {
  const markerHasGps = hasValidCoordinates(marker.gps_lat, marker.gps_lng)
  const resolvedHasGps = hasValidCoordinates(gps.gps_lat, gps.gps_lng)
  if (!markerHasGps && resolvedHasGps) return true
  if (
    markerHasGps &&
    resolvedHasGps &&
    (marker.gps_lat !== gps.gps_lat || marker.gps_lng !== gps.gps_lng)
  ) {
    return true
  }
  return false
}

async function persistGpsOnOrder(orderId: string, gps: ProjectMarkerGpsResult): Promise<void> {
  if (!hasValidCoordinates(gps.gps_lat, gps.gps_lng)) return

  const { error } = await supabase
    .from('job_orders')
    .update({
      gps_lat: gps.gps_lat,
      gps_lng: gps.gps_lng,
      gps_accuracy: gps.gps_accuracy,
    })
    .eq('id', orderId)

  if (error) {
    console.error('[zakazky-mapa] Uložení GPS do zakázky selhalo:', error.message)
  }
}

async function upsertMarkerGps(
  order: JobOrder,
  gps: ProjectMarkerGpsResult
): Promise<{ created: boolean; updated: boolean; error?: string }> {
  const existing = await fetchProjectMapMarker(order.id)

  if (existing) {
    if (!markerNeedsGpsUpdate(existing, gps)) {
      return { created: false, updated: false }
    }

    const { error } = await supabase
      .from('project_map_markers')
      .update({
        gps_lat: gps.gps_lat,
        gps_lng: gps.gps_lng,
        gps_accuracy: gps.gps_accuracy,
        is_approximate: gps.is_approximate,
      })
      .eq('project_id', order.id)

    if (error) {
      return { created: false, updated: false, error: error.message }
    }
    return { created: false, updated: true }
  }

  const payload = buildProjectMapMarkerInsert(order.id, gps)
  const { error } = await supabase.from('project_map_markers').insert({ ...payload })

  if (error) {
    if (error.code === '23505') {
      return { created: false, updated: false }
    }
    return { created: false, updated: false, error: error.message }
  }

  return { created: true, updated: false }
}

/**
 * Vytvoří nebo doplní hlavní špendlík zakázky včetně geokódování adresy/města.
 */
export async function ensureProjectMapMarkerForOrder(order: JobOrder): Promise<EnsureMarkerResult> {
  return replenishProjectMapLocation(order)
}

/** Geokóduje adresu zakázky a uloží souřadnice do project_map_markers i job_orders. */
export async function replenishProjectMapLocation(order: JobOrder): Promise<EnsureMarkerResult> {
  const base: EnsureMarkerResult = {
    projectId: order.id,
    hasGps: false,
    geocoded: false,
    created: false,
    updated: false,
  }

  try {
    const hadGps = hasValidCoordinates(order.gps_lat, order.gps_lng)
    const gps = await resolveProjectMarkerGps(orderLocationFields(order))
    const geocoded = !hadGps && hasValidCoordinates(gps.gps_lat, gps.gps_lng)

    const { created, updated, error } = await upsertMarkerGps(order, gps)

    if (error) {
      console.error('[zakazky-mapa] Špendlík:', error)
      return { ...base, error }
    }

    if (geocoded || updated) {
      await persistGpsOnOrder(order.id, gps)
    }

    await recalculateProjectMarkerColor(order.id)

    return {
      projectId: order.id,
      hasGps: hasValidCoordinates(gps.gps_lat, gps.gps_lng),
      geocoded,
      created,
      updated,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba'
    console.error('[zakazky-mapa] Doplnění polohy selhalo:', message)
    return { ...base, error: message }
  }
}

/** Backfill GPS pro zakázky bez souřadnic (respektuje rate limit Nominatim). */
export async function backfillMissingProjectLocations(
  orders: JobOrder[],
  onProgress?: (result: EnsureMarkerResult) => void
): Promise<EnsureMarkerResult[]> {
  const results: EnsureMarkerResult[] = []
  const missing = orders.filter(
    (order) =>
      !isValidProjectMarkerGps(order.gps_lat, order.gps_lng) &&
      Boolean(buildGeocodeQueryFromOrder(order))
  )

  for (let i = 0; i < missing.length; i++) {
    const result = await replenishProjectMapLocation(missing[i])
    results.push(result)
    onProgress?.(result)
    if (i < missing.length - 1) {
      await delay(GEOCODE_RATE_LIMIT_MS)
    }
  }

  return results
}
