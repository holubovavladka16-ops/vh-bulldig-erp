import { Loader2, MapPin, RefreshCw } from 'lucide-react'
import { FOTO_GPS_STATUS_LABELS } from '@/constants/fotodokumentace'
import type { FotoGpsFaze } from '@/hooks/fotodokumentace/usePostCaptureLocation'
import type { FotoAdresa, FotoPoloha } from '@/types/fotodokumentace'

interface FotoGpsPanelProps {
  faze: FotoGpsFaze
  poloha: FotoPoloha | null
  adresa: FotoAdresa | null
  accuracy: number | null
  chyba: string | null
  manualAdresa: string
  onManualChange: (v: string) => void
  onRetry: () => void
  onSaveWithoutGps: () => void
  gpsStatus: string
}

export function FotoGpsPanel({
  faze,
  poloha,
  adresa,
  accuracy,
  chyba,
  manualAdresa,
  onManualChange,
  onRetry,
  onSaveWithoutGps,
  gpsStatus,
}: FotoGpsPanelProps) {
  if (faze === 'loading') {
    return (
      <div className="neon-border rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítám GPS polohu…
          {accuracy != null && <span>(±{Math.round(accuracy)} m)</span>}
        </div>
      </div>
    )
  }

  if (faze === 'error') {
    return (
      <div className="neon-border rounded-xl p-4 space-y-3">
        <p className="text-sm text-red-400">{chyba ?? 'GPS se nepodařilo načíst.'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-neon rounded-lg px-3 py-2 text-sm" onClick={onRetry}>
            <RefreshCw className="mr-1 inline h-4 w-4" />
            Zkusit znovu
          </button>
          <button type="button" className="btn-neon rounded-lg px-3 py-2 text-sm" onClick={onSaveWithoutGps}>
            Uložit bez GPS
          </button>
        </div>
        <label className="block text-sm">
          <span className="text-theme-secondary">Ruční adresa</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border-glass)] bg-transparent px-3 py-2"
            value={manualAdresa}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder="Zadejte adresu ručně"
          />
        </label>
      </div>
    )
  }

  if (faze === 'ready') {
    return (
      <div className="neon-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-green-400">
          <MapPin className="h-4 w-4" />
          Poloha byla načtena
        </div>
        {poloha && (
          <p className="text-xs text-theme-muted">
            GPS: {poloha.lat.toFixed(6)}, {poloha.lng.toFixed(6)}
            {accuracy != null && ` · Přesnost: ${Math.round(accuracy)} m`}
          </p>
        )}
        <p className="text-sm text-theme-primary">{adresa?.address_full || manualAdresa || '—'}</p>
        <p className="text-xs text-theme-muted">
          {FOTO_GPS_STATUS_LABELS[gpsStatus as keyof typeof FOTO_GPS_STATUS_LABELS] ?? gpsStatus}
        </p>
        {!poloha && (
          <input
            className="w-full rounded-lg border border-[var(--border-glass)] bg-transparent px-3 py-2 text-sm"
            value={manualAdresa}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder="Upravit adresu"
          />
        )}
      </div>
    )
  }

  return null
}
