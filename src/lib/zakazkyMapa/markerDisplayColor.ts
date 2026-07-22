import type { JobOrder } from '@/types/orders'
import type { ProjectMapMarker, ProjectMarkerColorSource } from '@/types/zakazkyMapa'
import {
  computeMarkerAutoColor,
  type MarkerColorComputeInput,
} from '@/lib/zakazkyMapa/computeMarkerColor'
import { getCompanyLocalDateTime } from '@/lib/zakazkyMapa/companyTime'
import {
  PROJECT_MARKER_DEFAULT_CHECK_TIME,
  PROJECT_MARKER_DEFAULT_COLOR,
  PROJECT_MARKER_DEFAULT_WORKING_DAYS,
  PROJECT_MARKER_NEW_ORDER_LABEL,
} from '@/constants/zakazkyMapa'
import { PROJECT_MARKER_MISSING_DIARY_LABEL } from '@/constants/projectNotifications'

export interface MarkerDisplaySettings {
  diary_check_time: string
  working_days: number[]
  timezone: string
}

const DEFAULT_DISPLAY_SETTINGS: MarkerDisplaySettings = {
  diary_check_time: PROJECT_MARKER_DEFAULT_CHECK_TIME,
  working_days: PROJECT_MARKER_DEFAULT_WORKING_DAYS,
  timezone: 'Europe/Prague',
}

/** Přepočte barvu špendlíku pro zobrazení (mapa + seznam), pokud je zdroj auto. */
export function resolveAutoMarkerDisplay(
  order: JobOrder,
  marker: ProjectMapMarker,
  diaryEntryDates: string[],
  settings: MarkerDisplaySettings = DEFAULT_DISPLAY_SETTINGS
): Pick<ProjectMapMarker, 'marker_color' | 'color_label' | 'color_source'> {
  if ((marker.color_source as ProjectMarkerColorSource) === 'manual') {
    return {
      marker_color: marker.marker_color,
      color_label: marker.color_label,
      color_source: marker.color_source,
    }
  }

  if (diaryEntryDates.length === 0) {
    return {
      marker_color: PROJECT_MARKER_DEFAULT_COLOR,
      color_label: PROJECT_MARKER_NEW_ORDER_LABEL,
      color_source: 'auto',
    }
  }

  const localNow = getCompanyLocalDateTime(new Date(), settings.timezone)
  const computed = computeMarkerAutoColor({
    startDate: order.start_date,
    endDate: order.end_date,
    diaryEntryDates,
    diaryCheckTime: settings.diary_check_time,
    workingDays: settings.working_days,
    today: localNow.isoDate,
    now: new Date(),
  })

  return {
    marker_color: computed.color,
    color_label: computed.label,
    color_source: 'auto',
  }
}

export function buildPlaceholderMarkerWithColor(
  order: JobOrder,
  diaryEntryDates: string[] = [],
  settings?: MarkerDisplaySettings
): ProjectMapMarker {
  const now = new Date().toISOString()
  const display = resolveAutoMarkerDisplay(
    order,
    {
      id: `placeholder-${order.id}`,
      project_id: order.id,
      gps_lat: order.gps_lat,
      gps_lng: order.gps_lng,
      gps_accuracy: order.gps_accuracy,
      is_approximate: order.gps_lat == null || order.gps_lng == null,
      marker_color: 'red',
      color_source: 'auto',
      color_label: PROJECT_MARKER_MISSING_DIARY_LABEL,
      created_at: now,
      updated_at: now,
    },
    diaryEntryDates,
    settings
  )

  return {
    id: `placeholder-${order.id}`,
    project_id: order.id,
    gps_lat: order.gps_lat,
    gps_lng: order.gps_lng,
    gps_accuracy: order.gps_accuracy,
    is_approximate: order.gps_lat == null || order.gps_lng == null,
    marker_color: display.marker_color,
    color_source: display.color_source,
    color_label: display.color_label,
    created_at: now,
    updated_at: now,
  }
}

export type { MarkerColorComputeInput }
