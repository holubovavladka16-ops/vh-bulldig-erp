import { supabase } from '@/lib/supabase'
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
