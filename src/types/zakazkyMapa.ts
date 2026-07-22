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
