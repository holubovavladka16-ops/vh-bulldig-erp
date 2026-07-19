import { Loader2, MapPin, RefreshCw, AlertTriangle } from 'lucide-react'
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
  targetMeters: number
  onManualChange: (v: string) => void
  onRetry: () => void
  onSaveWithoutGps: () => void
  onAcceptLowAccuracy: () => void
  gpsStatus: string
}

export function FotoGpsPanel({
  faze,
  poloha,
  adresa,
  accuracy,
  chyba,
  manualAdresa,
  targetMeters,
  onManualChange,
  onRetry,
  onSaveWithoutGps,
  onAcceptLowAccuracy,
  gpsStatus,
}: FotoGpsPanelProps) {
  if (faze === 'loading') {
    const accText = accuracy != null ? `±${Math.round(accuracy)} m` : '…'
    const cile = accuracy != null && accuracy <= targetMeters
    return (
      <div className="neon-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítám GPS polohu…
        </div>
        <p className="text-xs text-theme-muted">
          Přesnost: {accText} · cíl ±{targetMeters} m · max 8 s
        </p>
        {cile && (
          <p className="text-xs text-green-400">Poloha splňuje požadovanou přesnost.</p>
        )}
      </div>
    )
  }

  if (faze === 'low_accuracy') {
    return (
      <div className="neon-border rounded-xl border-amber-500/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Poloha načtena, ale přesnost je nízká (±{Math.round(accuracy ?? 0)} m)
        </div>
        <p className="text-xs text-theme-muted">
          Pro fotodokumentaci je požadována přesnost ±{targetMeters} m. Přesuňte se na volné prostranství nebo počkejte.
        </p>
        {poloha && (
          <p className="text-xs text-theme-muted">
            GPS: {poloha.lat.toFixed(6)}, {poloha.lng.toFixed(6)}
          </p>
        )}
        <p className="text-sm text-theme-primary">{adresa?.address_full || '—'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-neon rounded-lg px-3 py-2 text-sm" onClick={onRetry}>
            <RefreshCw className="mr-1 inline h-4 w-4" />
            Zkusit přesnější polohu
          </button>
          <button type="button" className="btn-neon rounded-lg px-3 py-2 text-sm" onClick={onAcceptLowAccuracy}>
            Použít tuto polohu
          </button>
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
            {accuracy != null && ` · Přesnost: ±${Math.round(accuracy)} m`}
          </p>
        )}
        <p className="text-sm text-theme-primary">{adresa?.address_full || manualAdresa || '—'}</p>
        <p className="text-xs text-theme-muted">
          {FOTO_GPS_STATUS_LABELS[gpsStatus as keyof typeof FOTO_GPS_STATUS_LABELS] ?? gpsStatus}
        </p>
        {poloha && (
          <input
            className="w-full rounded-lg border border-[var(--border-glass)] bg-transparent px-3 py-2 text-sm"
            value={adresa?.address_full ?? ''}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder="Upravit adresu"
          />
        )}
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
