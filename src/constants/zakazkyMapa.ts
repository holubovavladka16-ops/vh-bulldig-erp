import type { ProjectMarkerColor, ProjectMarkerColorSource } from '@/types/zakazkyMapa'

export const PROJECT_MARKER_DEFAULT_COLOR: ProjectMarkerColor = 'green'
export const PROJECT_MARKER_DEFAULT_COLOR_SOURCE: ProjectMarkerColorSource = 'auto'
export const PROJECT_MARKER_NEW_ORDER_LABEL = 'Nová zakázka'

/** Geokódovaná adresa je považována za přibližnou polohu. */
export const PROJECT_MARKER_GEOCODE_APPROXIMATE = true

/** Přesnost GPS z zařízení (metry) – nad touto hranicí je špendlík přibližný. */
export const PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M = 20

export const PROJECT_MAP_CZECH_CENTER: [number, number] = [49.8175, 15.473]
export const PROJECT_MAP_DEFAULT_ZOOM = 7
export const PROJECT_MAP_SINGLE_MARKER_ZOOM = 14

export const PROJECT_MARKER_COLOR_HEX: Record<ProjectMarkerColor, string> = {
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  blue: '#3b82f6',
}

export const PROJECT_MARKER_COLOR_LABELS: Record<ProjectMarkerColor, string> = {
  green: 'Zelená',
  red: 'Červená',
  orange: 'Oranžová',
  blue: 'Modrá',
}

export const PROJECT_MARKER_COLOR_FILTER_OPTIONS: { value: ProjectMarkerColor | ''; label: string }[] = [
  { value: '', label: 'Všechny barvy' },
  { value: 'green', label: PROJECT_MARKER_COLOR_LABELS.green },
  { value: 'red', label: PROJECT_MARKER_COLOR_LABELS.red },
  { value: 'orange', label: PROJECT_MARKER_COLOR_LABELS.orange },
  { value: 'blue', label: PROJECT_MARKER_COLOR_LABELS.blue },
]

export const PROJECT_MAP_MISSING_LOCATION_LABEL = 'Poloha není doplněna'
