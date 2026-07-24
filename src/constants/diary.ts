export type DiaryWeatherType =
  | 'slunecno'
  | 'polojasno'
  | 'zatazeno'
  | 'dest'
  | 'snih'
  | 'bourka'
  | 'mlha'
  | 'vittr'

export const DIARY_WEATHER_OPTIONS: { value: DiaryWeatherType; label: string }[] = [
  { value: 'slunecno', label: 'Slunečno' },
  { value: 'polojasno', label: 'Polojasno' },
  { value: 'zatazeno', label: 'Zataženo' },
  { value: 'dest', label: 'Déšť' },
  { value: 'snih', label: 'Sníh' },
  { value: 'bourka', label: 'Bouřka' },
  { value: 'mlha', label: 'Mlha' },
  { value: 'vittr', label: 'Vítr' },
]

export const DIARY_EQUIPMENT_OPTIONS = [
  'Bagr',
  'Minibagr',
  'Nakladač',
  'Nákladní auto',
  'Dodávka',
  'Vibrační deska',
  'Kompresor',
  'Svařovací agregát',
  'Kompaktor',
  'Ruční nářadí',
  'Bez techniky',
] as const

export const DIARY_MATERIAL_OPTIONS = [
  'Písek',
  'Štěrk',
  'Beton',
  'Cement',
  'Dlažba',
  'Trubky PE',
  'Trubky PVC',
  'Kabely',
  'Geotextilie',
  'Ocel',
  'Dřevo',
] as const

export type DiaryEntryStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'returned'
  | 'rejected'

export const DIARY_ENTRY_STATUS_LABELS: Record<DiaryEntryStatus, string> = {
  draft: 'Rozepsáno',
  submitted: 'Odesláno',
  pending_review: 'Čeká na kontrolu',
  approved: 'Schváleno',
  returned: 'Vráceno k opravě',
  rejected: 'Zamítnuto',
}

export function formatDiaryWeather(weatherType: string | null | undefined, temperature: number | null | undefined): string {
  const label = DIARY_WEATHER_OPTIONS.find((o) => o.value === weatherType)?.label ?? weatherType ?? ''
  if (!label) return ''
  if (temperature != null && !Number.isNaN(temperature)) {
    return `${label}, ${temperature} °C`
  }
  return label
}

export function parseChipValues(saved: string, knownOptions: readonly string[]): { selected: string[]; custom: string } {
  if (!saved.trim()) return { selected: [], custom: '' }
  const parts = saved.split(',').map((p) => p.trim()).filter(Boolean)
  const selected: string[] = []
  const customParts: string[] = []
  for (const part of parts) {
    if (knownOptions.includes(part)) selected.push(part)
    else customParts.push(part)
  }
  return { selected, custom: customParts.join(', ') }
}

export function joinChipValues(selected: string[], custom: string): string {
  const parts = [...selected]
  if (custom.trim()) parts.push(custom.trim())
  return parts.join(', ')
}
