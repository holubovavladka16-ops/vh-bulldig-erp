import type {
  EmploymentType,
  PriceUnitType,
  WorkerDocumentCategory,
  WorkerFormStatus,
  WorkerReportStatus,
  WorkerStatus,
  WorkType,
} from '@/types/workers'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  HPP: 'HPP',
  DPP: 'DPP',
  DPC: 'DPČ',
  ICO: 'IČO',
}

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  aktivni: 'Aktivní',
  neaktivni: 'Neaktivní',
  archiv: 'Archiv',
}

export const WORKER_FORM_STATUS_LABELS: Record<WorkerFormStatus, string> = {
  koncept: 'Koncept',
  odeslany: 'Odeslaný',
  schvaleny: 'Schválený',
  k_oprave: 'K opravě',
}

export const WORKER_REPORT_STATUS_LABELS: Record<WorkerReportStatus, string> = {
  cekajici: 'Čeká na schválení',
  schvaleny: 'Schváleno',
  k_oprave: 'Vráceno k opravě',
}

export const DOCUMENT_CATEGORY_LABELS: Record<WorkerDocumentCategory, string> = {
  pracovni_smlouva: 'Pracovní smlouva',
  dodatek: 'Dodatek',
  obcansky_prukaz: 'Občanský průkaz',
  ridicsky_prukaz: 'Řidičský průkaz',
  lekarska_prohlidka: 'Lékařská prohlídka',
  bozp: 'BOZP',
  certifikat: 'Certifikát',
  ostatni: 'Ostatní',
}

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  hodinova: 'Hodinová práce',
  ukolova: 'Úkolová práce',
  kombinovana: 'Kombinovaná práce',
}

export const WORK_TYPE_DESCRIPTIONS: Record<WorkType, string> = {
  hodinova: 'Výdělek se počítá pouze podle hodinové sazby.',
  ukolova: 'Výdělek se počítá pouze podle osobního ceníku. Hodiny slouží jen jako evidence docházky.',
  kombinovana: 'Výdělek = hodinová sazba + výkony podle osobního ceníku.',
}

export const PRICE_UNIT_LABELS: Record<PriceUnitType, string> = {
  hodina: 'Kč/hod',
  metr: 'Kč/bm',
  kus: 'Kč/ks',
  m2: 'Kč/m²',
  den: 'Kč/den',
  pausal: 'Kč/paušál',
}

export const DEFAULT_PRICE_ITEMS: { name: string; unit_type: PriceUnitType; sort_order: number }[] = [
  { name: 'Hodinová sazba', unit_type: 'hodina', sort_order: 1 },
  { name: 'Ruční výkop hloubka 50–70 cm', unit_type: 'metr', sort_order: 2 },
  { name: 'Ruční výkop hloubka 80–100 cm', unit_type: 'metr', sort_order: 3 },
  { name: 'Průraz do objektu', unit_type: 'kus', sort_order: 4 },
  { name: 'Demontáž zámkové dlažby', unit_type: 'm2', sort_order: 5 },
  { name: 'Pokládka zámkové dlažby', unit_type: 'm2', sort_order: 6 },
  { name: 'Denní úkol', unit_type: 'den', sort_order: 7 },
  { name: 'Jiné', unit_type: 'kus', sort_order: 8 },
]

export const WORKER_TABS = [
  { id: 'osobni-karta' as const, label: 'Osobní karta' },
  { id: 'cenik' as const, label: 'Osobní ceník' },
  { id: 'dokumenty' as const, label: 'Dokumenty' },
  { id: 'vykazy' as const, label: 'Výkazy' },
  { id: 'dochazka' as const, label: 'Docházka' },
  { id: 'historie' as const, label: 'Historie' },
  { id: 'formular' as const, label: 'Formulář zaměstnance' },
]

export const PORTAL_TABS = [
  { id: 'denni-formular' as const, label: 'Denní formulář' },
  { id: 'muj-vykaz' as const, label: 'Můj výkaz' },
  { id: 'prehled-vydelku' as const, label: 'Přehled výdělku' },
]

export const LEGACY_PORTAL_TAB_REDIRECTS: Record<string, 'prehled-vydelku' | 'muj-vykaz' | 'denni-formular'> = {
  'moje-dochazka': 'prehled-vydelku',
}

export function getPortalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('cs-CZ', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(date))
}

export function formatDateFromDate(date: Date): string {
  return new Intl.DateTimeFormat('cs-CZ').format(date)
}

export function formatTime(value: string | Date): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' }).format(value)
  }
  if (value.includes('T')) {
    return formatTime(new Date(value))
  }
  return value.slice(0, 5)
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
