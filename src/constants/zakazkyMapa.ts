import type { ProjectMarkerColor, ProjectMarkerColorSource } from '@/types/zakazkyMapa'

export const PROJECT_MARKER_DEFAULT_COLOR: ProjectMarkerColor = 'green'
export const PROJECT_MARKER_DEFAULT_COLOR_SOURCE: ProjectMarkerColorSource = 'auto'
export const PROJECT_MARKER_NEW_ORDER_LABEL = 'Nová zakázka'

/** Geokódovaná adresa je považována za přibližnou polohu. */
export const PROJECT_MARKER_GEOCODE_APPROXIMATE = true

/** Přesnost GPS z zařízení (metry) – nad touto hranicí je špendlík přibližný. */
export const PROJECT_MARKER_DEVICE_APPROXIMATE_THRESHOLD_M = 20
