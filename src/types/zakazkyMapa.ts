export type ProjectMarkerColor = 'green' | 'red' | 'orange' | 'blue'
export type ProjectMarkerColorSource = 'auto' | 'manual'

export interface ProjectMapMarker {
  id: string
  project_id: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  is_approximate: boolean
  marker_color: ProjectMarkerColor
  color_source: ProjectMarkerColorSource
  color_label: string
  created_at: string
  updated_at: string
}

export interface ProjectMapMarkerInsert {
  project_id: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  is_approximate: boolean
  marker_color: ProjectMarkerColor
  color_source: ProjectMarkerColorSource
  color_label: string
}

export interface ProjectMapMarkerWithOrder extends ProjectMapMarker {
  order: import('@/types/orders').JobOrder
}

export interface ProjectMapMarkerFilters {
  search?: string
  markerColor?: ProjectMarkerColor | ''
}

export type ProjectMarkerChangeType = 'auto' | 'manual'

export interface ProjectMarkerStatusHistory {
  id: string
  project_id: string
  old_color: ProjectMarkerColor | null
  new_color: ProjectMarkerColor
  color_label: string
  change_type: ProjectMarkerChangeType
  missing_date: string | null
  reason: string | null
  valid_from: string | null
  valid_to: string | null
  changed_by: string | null
  changed_by_name?: string
  created_at: string
}

export interface ManualMarkerColorInput {
  projectId: string
  color: ProjectMarkerColor
  reason: string
  changedBy: string
}
