import type { ProjectMarkerColor, ProjectMarkerColorSource } from '@/types/zakazkyMapa'
import { PROJECT_MARKER_MISSING_DIARY_LABEL } from '@/constants/projectNotifications'

export const PROJECT_MARKER_DEFAULT_COLOR: ProjectMarkerColor = 'red'
export const PROJECT_MARKER_DEFAULT_COLOR_SOURCE: ProjectMarkerColorSource = 'auto'
/** Výchozí popisek nového špendlíku bez záznamu deníku. */
export const PROJECT_MARKER_NEW_ORDER_LABEL = PROJECT_MARKER_MISSING_DIARY_LABEL

/** Automatické popisky barev (Fáze 1e). */
export const PROJECT_MARKER_AUTO_COLOR_LABELS: Record<ProjectMarkerColor, string> = {
  green: 'Probíhá v pořádku',
  orange: 'Vyžaduje kontrolu',
  red: 'Vyžaduje zásah',
  blue: 'Čeká na zahájení',
}

/** Ruční popisky barev (Fáze 1f). */
export const PROJECT_MARKER_MANUAL_COLOR_LABELS: Record<ProjectMarkerColor, string> = {
  green: 'Bez problému',
  orange: 'Vyžaduje pozornost',
  red: 'Kritický problém',
  blue: 'Čeká na zahájení',
}

export const PROJECT_MARKER_MANUAL_COLOR_OPTIONS: {
  value: ProjectMarkerColor
  label: string
  emoji: string
}[] = [
  { value: 'green', label: PROJECT_MARKER_MANUAL_COLOR_LABELS.green, emoji: '🟢' },
  { value: 'orange', label: PROJECT_MARKER_MANUAL_COLOR_LABELS.orange, emoji: '🟠' },
  { value: 'red', label: PROJECT_MARKER_MANUAL_COLOR_LABELS.red, emoji: '🔴' },
  { value: 'blue', label: PROJECT_MARKER_MANUAL_COLOR_LABELS.blue, emoji: '🔵' },
]

export const PROJECT_MARKER_REVERT_AUTO_REASON = 'Vráceno na automatický výpočet'

export const PROJECT_MARKER_CHANGE_TYPE_LABELS: Record<'auto' | 'manual', string> = {
  auto: 'Automaticky',
  manual: 'Ručně',
}

/** Po kolika chybějících pracovních dnech deníku → červená. */
export const PROJECT_MARKER_LONG_MISSING_WORKING_DAYS = 3

/** Kolik dní před termínem dokončení → oranžová. */
export const PROJECT_MARKER_APPROACHING_END_DAYS = 7

/** Výchozí kontrolní čas deníku (odpovídá migraci 068). */
export const PROJECT_MARKER_DEFAULT_CHECK_TIME = '20:00:00'

/** Výchozí pracovní dny Po–Pá (PostgreSQL DOW). */
export const PROJECT_MARKER_DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]

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
