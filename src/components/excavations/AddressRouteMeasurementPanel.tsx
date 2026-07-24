import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { forwardGeocode } from '@/lib/photos/geocoding'
import type { ExcavationPoint } from '@/types/excavations'

export interface AddressRouteResult {
  points: ExcavationPoint[]
  label: string
  mapFocus: { lat: number; lng: number; zoom: number }
}

interface AddressRouteMeasurementPanelProps {
  disabled?: boolean
  onComplete: (result: AddressRouteResult) => void
  onCancel: () => void
}

export function AddressRouteMeasurementPanel({
  disabled,
  onComplete,
  onCancel,
}: AddressRouteMeasurementPanelProps) {
  const [startAddress, setStartAddress] = useState('')
  const [endAddress, setEndAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function searchAndMeasure() {
    setError('')
    if (!startAddress.trim()) {
      setError('Zadejte adresu začátku včetně čísla popisného.')
      return
    }
    if (!endAddress.trim()) {
      setError('Zadejte adresu konce včetně čísla popisného.')
      return
    }

    setSearching(true)
    try {
      const [startResult, endResult] = await Promise.all([
        forwardGeocode(startAddress),
        forwardGeocode(endAddress),
      ])

      if (!startResult) {
        setError('Adresu začátku se nepodařilo najít. Zkuste upřesnit (ulice, č.p., město).')
        return
      }
      if (!endResult) {
        setError('Adresu konce se nepodařilo najít. Zkuste upřesnit (ulice, č.p., město).')
        return
      }

      const points: ExcavationPoint[] = [
        { lat: startResult.lat, lng: startResult.lng, label: startResult.display_name },
        { lat: endResult.lat, lng: endResult.lng, label: endResult.display_name },
      ]

      const centerLat = (startResult.lat + endResult.lat) / 2
      const centerLng = (startResult.lng + endResult.lng) / 2

      onComplete({
        points,
        label: `${startResult.display_name} → ${endResult.display_name}`,
        mapFocus: { lat: centerLat, lng: centerLng, zoom: 16 },
      })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div>
        <h3 className="font-semibold text-theme-primary">Měření podle adresy od–do</h3>
        <p className="mt-1 text-sm text-theme-muted">
          Zadejte adresu začátku a konce trasy. Aplikace obě adresy najde na mapě,
          vytvoří body Start a Konec a spočítá vzdálenost v metrech.
        </p>
      </div>

      <Input
        label="Adresa začátku (Start)"
        value={startAddress}
        onChange={(e) => setStartAddress(e.target.value)}
        placeholder="Např. Husova 12, Praha 1"
        disabled={disabled || searching}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void searchAndMeasure()
        }}
      />

      <Input
        label="Adresa konce (Konec)"
        value={endAddress}
        onChange={(e) => setEndAddress(e.target.value)}
        placeholder="Např. Národní 25, Praha 1"
        disabled={disabled || searching}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void searchAndMeasure()
        }}
      />

      <Button
        type="button"
        onClick={() => void searchAndMeasure()}
        loading={searching}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        <Search className="h-4 w-4" />
        Najít adresy a spočítat vzdálenost
      </Button>

      {searching && (
        <p className="flex items-center gap-2 text-sm text-theme-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Hledám obě adresy na mapě…
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        Zrušit měření
      </Button>
    </div>
  )
}
