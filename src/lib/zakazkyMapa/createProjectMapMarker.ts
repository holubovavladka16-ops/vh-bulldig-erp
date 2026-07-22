import { forwardGeocode } from '@/lib/photos/geocoding'
import { supabase } from '@/lib/supabase'
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

  try {
    const geocoded = await forwardGeocode(input.location!.trim())
    if (geocoded) {
      return {
        gps_lat: geocoded.lat,
        gps_lng: geocoded.lng,
        gps_accuracy: null,
        is_approximate: PROJECT_MARKER_GEOCODE_APPROXIMATE,
      }
    }
  } catch {
    // Geokódování nesmí přerušit vytvoření zakázky ani špendlíku.
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

export async function projectMapMarkerExists(projectId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_map_markers')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data != null
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
  return {
    gps_lat: order.gps_lat,
    gps_lng: order.gps_lng,
    gps_accuracy: order.gps_accuracy,
    location: order.location,
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

/**
 * Vytvoří nebo aktualizuje hlavní špendlík zakázky (1:1).
 * Geokóduje adresu, pokud zakázka nemá GPS. Chyby insertu loguje, ale nepropaguje –
 * vytvoření zakázky nesmí selhat kvůli špendlíku (mapa zobrazí placeholder ze zakázky).
 */
export async function ensureProjectMapMarkerForOrder(order: JobOrder): Promise<void> {
  try {
    const gps = await resolveProjectMarkerGps(orderLocationFields(order))
    const existing = await fetchProjectMapMarker(order.id)

    if (existing) {
      if (markerNeedsGpsUpdate(existing, gps)) {
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
          console.error('[zakazky-mapa] Aktualizace GPS špendlíku selhala:', error.message)
        }
      }
      await recalculateProjectMarkerColor(order.id)
      return
    }

    const payload = buildProjectMapMarkerInsert(order.id, gps)
    const { error } = await supabase.from('project_map_markers').insert({ ...payload })

    if (error) {
      if (error.code === '23505') {
        return
      }
      console.error('[zakazky-mapa] Nepodařilo se vytvořit hlavní špendlík:', error.message)
    } else {
      await recalculateProjectMarkerColor(order.id)
    }
  } catch (err) {
    console.error(
      '[zakazky-mapa] Chyba při vytváření hlavního špendlíku:',
      err instanceof Error ? err.message : err
    )
  }
}
