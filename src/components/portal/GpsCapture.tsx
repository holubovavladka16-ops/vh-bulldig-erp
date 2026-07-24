import { useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface GpsCaptureProps {
  lat: number | null
  lng: number | null
  accuracy: number | null
  onCapture: (lat: number, lng: number, accuracy: number) => void
  disabled?: boolean
}

export function GpsCapture({ lat, lng, accuracy, onCapture, disabled }: GpsCaptureProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function capture() {
    if (disabled || !navigator.geolocation) {
      setError('GPS není v prohlížeči dostupné.')
      return
    }

    setLoading(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCapture(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={capture} disabled={disabled || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {lat != null ? 'Aktualizovat polohu' : 'Zaznamenat GPS polohu'}
        </Button>
        {lat != null && lng != null && (
          <p className="text-sm text-theme-secondary">
            {lat.toFixed(5)}, {lng.toFixed(5)}
            {accuracy != null && ` (±${Math.round(accuracy)} m)`}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
