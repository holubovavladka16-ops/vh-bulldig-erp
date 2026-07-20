import type { FdgSyncStatus } from '@/types/fotodokumentaceGps'

export const FDG_GPS_LOAD_TIMEOUT_MS = 6000

export const FDG_SYNC_LABELS: Record<FdgSyncStatus, string> = {
  offline: 'Uloženo offline',
  pending: 'Čeká na synchronizaci',
  uploading: 'Nahrávám',
  synced: 'Synchronizováno',
  error: 'Chyba nahrávání',
}

export const FDG_GPS_UNVERIFIED_LABEL = 'Poloha nebyla ověřena'
