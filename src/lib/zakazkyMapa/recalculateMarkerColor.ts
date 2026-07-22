import { supabase } from '@/lib/supabase'
import { computeMarkerAutoColor } from '@/lib/zakazkyMapa/computeMarkerColor'
import { insertMarkerColorHistory } from '@/lib/zakazkyMapa/markerColorHistory'
import {
  PROJECT_MARKER_DEFAULT_CHECK_TIME,
  PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
  PROJECT_MARKER_DEFAULT_WORKING_DAYS,
} from '@/constants/zakazkyMapa'
import type { JobOrder } from '@/types/orders'
import type { ProjectMapMarker, ProjectMarkerColorSource } from '@/types/zakazkyMapa'

export interface RecalculateMarkerColorOptions {
  recordHistory?: boolean
}

export interface MarkerRecalcSettings {
  diary_check_time: string
  working_days: number[]
  timezone: string
}

const DEFAULT_SETTINGS: MarkerRecalcSettings = {
  diary_check_time: PROJECT_MARKER_DEFAULT_CHECK_TIME,
  working_days: PROJECT_MARKER_DEFAULT_WORKING_DAYS,
  timezone: 'Europe/Prague',
}

async function fetchMarkerRecalcSettings(): Promise<MarkerRecalcSettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('diary_check_time, working_days, timezone')
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return DEFAULT_SETTINGS
  }

  const row = data as { diary_check_time?: string; working_days?: number[]; timezone?: string }
  return {
    diary_check_time: row.diary_check_time ?? DEFAULT_SETTINGS.diary_check_time,
    working_days: row.working_days ?? DEFAULT_SETTINGS.working_days,
    timezone: row.timezone ?? DEFAULT_SETTINGS.timezone,
  }
}

async function fetchValidDiaryEntryDates(orderId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .select('entry_date, entry_status')
    .eq('order_id', orderId)
    .in('entry_status', ['approved', 'submitted', 'pending_review'])

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ entry_date: string }>).map((row) => row.entry_date)
}

async function fetchOrder(orderId: string): Promise<JobOrder | null> {
  const { data, error } = await supabase.from('job_orders').select('*').eq('id', orderId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as JobOrder | null
}

async function fetchMarker(projectId: string): Promise<ProjectMapMarker | null> {
  const { data, error } = await supabase
    .from('project_map_markers')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ProjectMapMarker | null
}

/**
 * Přepočítá barvu hlavního špendlíku pro jednu zakázku.
 * Ruční stavy (color_source = manual) se nemění.
 * Chyby nepropaguje – volající operace nesmí selhat kvůli přepočtu.
 */
export async function recalculateProjectMarkerColor(
  projectId: string,
  options: RecalculateMarkerColorOptions = {}
): Promise<ProjectMapMarker | null> {
  const recordHistory = options.recordHistory ?? true

  try {
    if (!projectId.trim()) return null

    const marker = await fetchMarker(projectId)
    if (!marker) return null

    if ((marker.color_source as ProjectMarkerColorSource) === 'manual') {
      return marker
    }

    const order = await fetchOrder(projectId)
    if (!order) return null

    const [entryDates, settings] = await Promise.all([
      fetchValidDiaryEntryDates(projectId),
      fetchMarkerRecalcSettings(),
    ])

    const computed = computeMarkerAutoColor({
      startDate: order.start_date,
      endDate: order.end_date,
      diaryEntryDates: entryDates,
      diaryCheckTime: settings.diary_check_time,
      workingDays: settings.working_days,
    })

    const oldColor = marker.marker_color
    const oldLabel = marker.color_label
    const colorChanged = computed.color !== oldColor || computed.label !== oldLabel

    const { data, error } = await supabase
      .from('project_map_markers')
      .update({
        marker_color: computed.color,
        color_label: computed.label,
        color_source: PROJECT_MARKER_DEFAULT_COLOR_SOURCE,
      })
      .eq('project_id', projectId)
      .eq('color_source', 'auto')
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('[zakazky-mapa] Přepočet barvy selhal:', error.message)
      return null
    }

    const updated = (data as ProjectMapMarker | null) ?? null

    if (updated && recordHistory && colorChanged) {
      await insertMarkerColorHistory({
        projectId,
        oldColor,
        newColor: updated.marker_color,
        colorLabel: updated.color_label,
        changeType: 'auto',
      })
    }

    return updated
  } catch (err) {
    console.error(
      '[zakazky-mapa] Chyba při přepočtu barvy špendlíku:',
      err instanceof Error ? err.message : err
    )
    return null
  }
}
