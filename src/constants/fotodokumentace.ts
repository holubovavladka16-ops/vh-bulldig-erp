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
  { id: 'schvalena', label: 'Schválené' },
  { id: 'kos', label: 'Koš' },
] as const

/** Parametry modulu – důkazní materiál pro specifikaci */
export const FOTO_MODUL_PARAMETRY = [
  { id: 'gps', label: 'GPS přesnost ±3 m', detail: 'Cíl ±3 m, timeout 8 s, předběžné načítání při náhledu' },
  { id: 'cas', label: 'Celý flow do 10 s', detail: 'Focení + GPS + ukládání s vizuálním timerem' },
  { id: 'mapy', label: 'Mapy.cz + Street View', detail: 'Embed map pod každou fotografií po pořízení i v detailu' },
  { id: 'adresa', label: 'Automatická adresa', detail: 'Reverse geocoding: ulice, obec, PSČ, stát' },
  { id: 'pdf', label: 'PDF A4 (1 foto = 1 stránka)', detail: 'Bulk export více fotografií, před/po PDF' },
  { id: 'sdileni', label: 'Sdílení WhatsApp / Messenger / e-mail', detail: 'Web Share API + dedikovaná tlačítka kanálů' },
  { id: 'schvaleni', label: 'Schvalovací workflow', detail: 'Nová → ke kontrole → schválená / zamítnutá / archiv' },
  { id: 'serie', label: 'Série fotografií', detail: 'Pořizování více fotek za sebou ve stejné sérii' },
  { id: 'predpo', label: 'Před / po porovnání', detail: 'Párování fotografií + PDF porovnání' },
  { id: 'offline', label: 'Offline fronta', detail: 'Automatická synchronizace po obnovení připojení' },
  { id: 'kos', label: 'Koš + obnova', detail: 'Soft delete s důvodem, obnovitelné fotografie' },
  { id: 'verejna', label: 'Veřejná galerie zakázky', detail: 'Token URL pro investora / externí strany' },
  { id: 'propojeni', label: 'Propojení modulů', detail: 'Zakázka, zaměstnanec, deník, přípojka' },
  { id: 'dictate', label: 'Hlasová poznámka', detail: 'Diktování poznámky k fotografii (Speech API)' },
] as const

export const FOTO_SCHVALENI_OPTIONS = [
  { value: '', label: 'Všechny stavy' },
  { value: 'nova', label: 'Nová' },
  { value: 'ke_kontrole', label: 'Ke kontrole' },
  { value: 'schvalena', label: 'Schválená' },
  { value: 'zamitnuta', label: 'Zamítnutá' },
  { value: 'archivovana', label: 'Archivovaná' },
] as const

export function getTypFotografieLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return VYCHOZI_TYPY_FOTOGRAFII.find((t) => t.code === code)?.label ?? code
}
