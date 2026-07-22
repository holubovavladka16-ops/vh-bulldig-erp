import { supabase } from '@/lib/supabase'
import {
  PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M,
} from '@/constants/zakazkyMapa'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'
import {
  buildPlaceholderMarkerWithColor,
  resolveAutoMarkerDisplay,
  type MarkerDisplaySettings,
} from '@/lib/zakazkyMapa/markerDisplayColor'
import {
  PROJECT_MARKER_DEFAULT_CHECK_TIME,
  PROJECT_MARKER_DEFAULT_WORKING_DAYS,
} from '@/constants/zakazkyMapa'
import type { JobOrder } from '@/types/orders'
import type { ProjectMapMarker, ProjectMapMarkerFilters, ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

async function fetchMarkerDisplaySettings(): Promise<MarkerDisplaySettings> {
  const { data } = await supabase
    .from('company_settings')
    .select('diary_check_time, working_days, timezone')
    .limit(1)
    .maybeSingle()

  if (!data) {
    return {
      diary_check_time: PROJECT_MARKER_DEFAULT_CHECK_TIME,
      working_days: PROJECT_MARKER_DEFAULT_WORKING_DAYS,
      timezone: 'Europe/Prague',
    }
  }

  const row = data as { diary_check_time?: string; working_days?: number[]; timezone?: string }
  return {
    diary_check_time: row.diary_check_time ?? PROJECT_MARKER_DEFAULT_CHECK_TIME,
    working_days: row.working_days ?? PROJECT_MARKER_DEFAULT_WORKING_DAYS,
    timezone: row.timezone ?? 'Europe/Prague',
  }
}

async function fetchDiaryDatesByOrderIds(orderIds: string[]): Promise<Map<string, string[]>> {
  if (orderIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('construction_diary_entries')
    .select('order_id, entry_date')
    .in('order_id', orderIds)
    .in('entry_status', ['approved', 'submitted', 'pending_review'])

  if (error) throw new Error(error.message)

  const map = new Map<string, string[]>()
  for (const row of (data ?? []) as Array<{ order_id: string; entry_date: string }>) {
    const list = map.get(row.order_id) ?? []
    list.push(row.entry_date)
    map.set(row.order_id, list)
  }
  return map
}

function applyDisplayColor(
  order: JobOrder,
  marker: ProjectMapMarker,
  diaryDates: string[],
  settings: MarkerDisplaySettings
): ProjectMapMarker {
  const display = resolveAutoMarkerDisplay(order, marker, diaryDates, settings)
  return {
    ...marker,
    marker_color: display.marker_color,
    color_label: display.color_label,
    color_source: display.color_source,
  }
}

/** Mapování zakázky bez markeru, nebo doplnění GPS ze zakázky pokud marker nemá souřadnice. */
export function mergeMarkerWithOrder(
  marker: ProjectMapMarker,
  order: JobOrder
): ProjectMapMarker {
  if (isValidProjectMarkerGps(marker.gps_lat, marker.gps_lng)) {
    return marker
  }

  if (isValidProjectMarkerGps(order.gps_lat, order.gps_lng)) {
    const accuracy = order.gps_accuracy ?? null
    return {
      ...marker,
      gps_lat: order.gps_lat,
      gps_lng: order.gps_lng,
      gps_accuracy: accuracy,
      is_approximate:
        accuracy == null || accuracy > PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M,
    }
  }

  return marker
}

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
  const [markersResult, diaryByOrder, settings] = await Promise.all([
    supabase.from('project_map_markers').select('*').in('project_id', projectIds),
    fetchDiaryDatesByOrderIds(projectIds),
    fetchMarkerDisplaySettings(),
  ])

  const { data: markers, error: markersError } = markersResult
  if (markersError) throw new Error(markersError.message)

  const markerByProject = new Map(
    ((markers ?? []) as ProjectMapMarker[]).map((marker) => [marker.project_id, marker])
  )

  return orderRows.map((order) => {
    const diaryDates = diaryByOrder.get(order.id) ?? []
    const baseMarker =
      markerByProject.get(order.id) ?? buildPlaceholderMarkerWithColor(order, diaryDates, settings)
    const withGps = mergeMarkerWithOrder(baseMarker, order)
    const withColor = applyDisplayColor(order, withGps, diaryDates, settings)
    return { ...withColor, order }
  })
}

export function buildPlaceholderMarker(order: JobOrder): ProjectMapMarker {
  return buildPlaceholderMarkerWithColor(order)
}

export async function fetchProjectMapMarkerByProjectId(
  projectId: string
): Promise<ProjectMapMarkerWithOrder | null> {
  const [settings, diaryByOrder] = await Promise.all([
    fetchMarkerDisplaySettings(),
    fetchDiaryDatesByOrderIds([projectId]),
  ])

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

  const jobOrder = order as JobOrder
  const diaryDates = diaryByOrder.get(projectId) ?? []
  const base =
    (marker as ProjectMapMarker | null) ??
    buildPlaceholderMarkerWithColor(jobOrder, diaryDates, settings)
  const withGps = mergeMarkerWithOrder(base, jobOrder)
  const withColor = applyDisplayColor(jobOrder, withGps, diaryDates, settings)

  return {
    ...withColor,
    order: jobOrder,
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
