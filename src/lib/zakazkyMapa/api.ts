import { supabase } from '@/lib/supabase'
import {
  PROJECT_MARKER_DEFAULT_COLOR,
  PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
  PROJECT_MARKER_NEW_ORDER_LABEL,
} from '@/constants/zakazkyMapa'
import type { JobOrder } from '@/types/orders'
import type { ProjectMapMarker, ProjectMapMarkerFilters, ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export async function fetchProjectMapMarkersWithOrders(): Promise<ProjectMapMarkerWithOrder[]> {
  const { data: markers, error: markersError } = await supabase
    .from('project_map_markers')
    .select('*')
    .order('updated_at', { ascending: false })

  if (markersError) throw new Error(markersError.message)

  const markerRows = (markers ?? []) as ProjectMapMarker[]
  if (markerRows.length === 0) return []

  const projectIds = [...new Set(markerRows.map((marker) => marker.project_id))]
  const { data: orders, error: ordersError } = await supabase
    .from('job_orders')
    .select('*')
    .in('id', projectIds)

  if (ordersError) throw new Error(ordersError.message)

  const orderById = new Map(
    ((orders ?? []) as JobOrder[]).map((order) => [order.id, order])
  )

  return markerRows
    .map((marker) => {
      const order = orderById.get(marker.project_id)
      if (!order) return null
      return { ...marker, order }
    })
    .filter((item): item is ProjectMapMarkerWithOrder => item != null)
}

/** Zakázky viditelné dle RLS + špendlík nebo placeholder (přiřazení bez markeru). */
export async function fetchProjectsWithMarkersFromOrders(): Promise<ProjectMapMarkerWithOrder[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('job_orders')
    .select('*')
    .order('updated_at', { ascending: false })

  if (ordersError) throw new Error(ordersError.message)

  const orderRows = (orders ?? []) as JobOrder[]
  if (orderRows.length === 0) return []

  const projectIds = orderRows.map((order) => order.id)
  const { data: markers, error: markersError } = await supabase
    .from('project_map_markers')
    .select('*')
    .in('project_id', projectIds)

  if (markersError) throw new Error(markersError.message)

  const markerByProject = new Map(
    ((markers ?? []) as ProjectMapMarker[]).map((marker) => [marker.project_id, marker])
  )

  return orderRows.map((order) => ({
    ...(markerByProject.get(order.id) ?? buildPlaceholderMarker(order)),
    order,
  }))
}

export function buildPlaceholderMarker(order: JobOrder): ProjectMapMarker {
  const now = new Date().toISOString()
  return {
    id: `placeholder-${order.id}`,
    project_id: order.id,
    gps_lat: order.gps_lat,
    gps_lng: order.gps_lng,
    gps_accuracy: order.gps_accuracy,
    is_approximate: order.gps_lat == null || order.gps_lng == null,
    marker_color: PROJECT_MARKER_DEFAULT_COLOR,
    color_source: PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
    color_label: PROJECT_MARKER_NEW_ORDER_LABEL,
    created_at: now,
    updated_at: now,
  }
}

export async function fetchProjectMapMarkerByProjectId(
  projectId: string
): Promise<ProjectMapMarkerWithOrder | null> {
  const { data: marker, error: markerError } = await supabase
    .from('project_map_markers')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (markerError) throw new Error(markerError.message)

  const { data: order, error: orderError } = await supabase
    .from('job_orders')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!order) return null

  return {
    ...((marker as ProjectMapMarker | null) ?? buildPlaceholderMarker(order as JobOrder)),
    order: order as JobOrder,
  }
}

export function filterProjectMapMarkers(
  items: ProjectMapMarkerWithOrder[],
  filters: ProjectMapMarkerFilters
): ProjectMapMarkerWithOrder[] {
  const query = filters.search?.trim().toLowerCase() ?? ''
  const color = filters.markerColor ?? ''

  return items.filter((item) => {
    if (color && item.marker_color !== color) return false
    if (!query) return true

    const haystack = [
      item.order.name,
      item.order.location,
      item.order.client_name ?? '',
      item.order.investor ?? '',
      item.color_label,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}
