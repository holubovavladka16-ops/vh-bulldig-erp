import type { FotoApprovalStatus, FotoGpsStatus, FotoSyncStatus } from '@/types/fotodokumentace'

export const FOTO_GPS_STATUS_LABELS: Record<FotoGpsStatus, string> = {
  verified: 'Poloha ověřena',
  unverified: 'Poloha nebyla ověřena',
  manual: 'Ručně zadaná adresa',
  missing: 'Bez GPS',
}

export const FOTO_APPROVAL_LABELS: Record<FotoApprovalStatus, string> = {
  nova: 'Nová',
  ke_kontrole: 'Ke kontrole',
  schvalena: 'Schválená',
  zamitnuta: 'Zamítnutá',
  archivovana: 'Archivovaná',
}

export const FOTO_SYNC_LABELS: Record<FotoSyncStatus, string> = {
  offline: 'Uloženo offline',
  pending: 'Čeká na synchronizaci',
  uploading: 'Nahrávám',
  synced: 'Synchronizováno',
  error: 'Chyba nahrávání',
}

export const VYCHOZI_TYPY_FOTOGRAFII = [
  { code: 'stav_pred', label: 'Stav před zahájením prací' },
  { code: 'prubeh', label: 'Průběh prací' },
  { code: 'dokonceno', label: 'Dokončená práce' },
  { code: 'vykop', label: 'Výkop' },
  { code: 'trasa', label: 'Trasa' },
  { code: 'pripojka', label: 'Přípojka' },
  { code: 'chranicka', label: 'Chránička' },
  { code: 'kabel', label: 'Kabel' },
  { code: 'pilir', label: 'Pilíř' },
  { code: 'pruraz', label: 'Průraz' },
  { code: 'dlazba', label: 'Dlažba' },
  { code: 'asfalt', label: 'Asfalt' },
  { code: 'zasyp', label: 'Zásyp' },
  { code: 'hutneni', label: 'Hutnění' },
  { code: 'material', label: 'Materiál' },
  { code: 'zavada', label: 'Závada' },
  { code: 'poskozeni', label: 'Poškození' },
  { code: 'kontrolni', label: 'Kontrolní fotografie' },
  { code: 'investor', label: 'Fotografie pro investora' },
  { code: 'jine', label: 'Jiné' },
] as const

export const RYCHLE_FILTRY = [
  { id: 'dnes', label: 'Dnes' },
  { id: 'tyden', label: 'Tento týden' },
  { id: 'mesic', label: 'Tento měsíc' },
  { id: '30dni', label: 'Posledních 30 dní' },
  { id: 'bez_gps', label: 'Bez GPS' },
  { id: 'ke_kontrole', label: 'Ke kontrole' },
] as const

export function getTypFotografieLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return VYCHOZI_TYPY_FOTOGRAFII.find((t) => t.code === code)?.label ?? code
}
