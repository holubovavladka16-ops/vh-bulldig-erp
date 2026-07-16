import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { getOpenStreetMapEmbedUrl } from '@/lib/photos/mapLinks'

interface FieldModeGpsCardProps {
  lat: number | null
  lng: number | null
  accuracy: number | null
  capturedAt: string | null
  disabled?: boolean
  onCapture: (lat: number, lng: number, accuracy: number, capturedAt: string) => void
}

export function FieldModeGpsCard({ lat, lng, accuracy, capturedAt, disabled, onCapture }: FieldModeGpsCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (error) {
      const timer = window.setTimeout(() => setError(''), 5000)
      return () => window.clearTimeout(timer)
    }
  }, [error])

  function capture() {
    if (disabled || !navigator.geolocation) {
      setError('GPS není v prohlížeči dostupné.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCapture(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, new Date().toISOString())
        setLoading(false)
      },
      () => {
        setError('Polohu se nepodařilo získat. Povolte GPS v prohlížeči.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <FieldModeCard title="GPS" icon="📍">
      <div className="field-mode-map mb-3">
        {lat != null && lng != null ? (
          <iframe title="Mapa polohy" src={getOpenStreetMapEmbedUrl(lat, lng)} loading="lazy" />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-theme-muted">
            Poloha zatím nebyla zaznamenána
          </div>
        )}
      </div>

      <button type="button" className="field-mode-btn-capture" onClick={capture} disabled={disabled || loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
        Zobrazit moji polohu
      </button>

      {lat != null && lng != null && (
        <div className="mt-3 space-y-1 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">
          <p className="font-semibold text-green-300">GPS nalezena</p>
          <p className="text-theme-secondary">
            Přesnost:{' '}
            {accuracy != null
              ? `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
              : '—'}
          </p>
          <p className="font-mono text-xs text-theme-primary">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
          {capturedAt && (
            <p className="text-xs text-theme-muted">
              Čas pořízení:{' '}
              {new Date(capturedAt).toLocaleString('cs-CZ', {
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </FieldModeCard>
  )
}
