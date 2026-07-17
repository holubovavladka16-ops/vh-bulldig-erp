import { useState } from 'react'
import { Loader2, MapPin, Navigation, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GpsPreflightPanel } from '@/components/photos/GpsPreflightPanel'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { GPS_MAX_WAIT_MS } from '@/lib/photos/gpsWatch'
import { forwardGeocode } from '@/lib/photos/geocoding'

export interface MapStartFocus {
  lat: number
  lng: number
  zoom: number
  label: string
  accuracy?: number
}

type StartMode = 'gps' | 'address'

interface ExcavationStartPanelProps {
  disabled?: boolean
  onMapReady: (focus: MapStartFocus) => void
}

export function ExcavationStartPanel({ disabled, onMapReady }: ExcavationStartPanelProps) {
  const [mode, setMode] = useState<StartMode>('gps')
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressError, setAddressError] = useState('')

  const gps = useGpsPreflight(gpsEnabled, {
    maxWaitMs: GPS_MAX_WAIT_MS,
    autoAcceptOnTimeout: false,
  })

  const gpsReady =
    gps.position != null &&
    (gps.phase === 'ready' || gps.phase === 'relaxed')

  function startGpsLocate() {
    setAddressError('')
    setGpsEnabled(true)
  }

  function openMapFromGps() {
    if (!gps.position) return
    onMapReady({
      lat: gps.position.lat,
      lng: gps.position.lng,
      zoom: 19,
      label: gps.address?.address_full ?? `${gps.position.lat.toFixed(6)}, ${gps.position.lng.toFixed(6)}`,
      accuracy: gps.position.accuracy,
    })
  }

  async function searchAddress() {
    setAddressError('')
    if (!addressQuery.trim()) {
      setAddressError('Zadejte adresu nebo místo.')
      return
    }
    setAddressSearching(true)
    try {
      const result = await forwardGeocode(addressQuery)
      if (!result) {
        setAddressError('Adresu se nepodařilo najít. Zkuste upřesnit (ulice, město).')
        return
      }
      onMapReady({
        lat: result.lat,
        lng: result.lng,
        zoom: 18,
        label: result.display_name,
      })
    } finally {
      setAddressSearching(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div>
        <h3 className="font-semibold text-theme-primary">Ruční kreslení na mapě</h3>
        <p className="mt-1 text-sm text-theme-muted">
          Určete místo v terénu podle GPS nebo adresy, poté klikáním nebo kreslením zakreslete trasu výkopu.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'gps' ? 'primary' : 'secondary'}
          onClick={() => setMode('gps')}
          disabled={disabled}
        >
          <Navigation className="h-4 w-4" />
          Zaměřit polohu
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'address' ? 'primary' : 'secondary'}
          onClick={() => setMode('address')}
          disabled={disabled}
        >
          <MapPin className="h-4 w-4" />
          Zadat adresu
        </Button>
      </div>

      {mode === 'gps' && (
        <div className="space-y-3">
          {!gpsEnabled ? (
            <Button type="button" onClick={startGpsLocate} disabled={disabled} className="w-full sm:w-auto">
              <Navigation className="h-4 w-4" />
              Zaměřit moji aktuální polohu
            </Button>
          ) : (
            <>
              <GpsPreflightPanel
                phase={gps.phase}
                position={gps.position}
                address={gps.address}
                addressLoading={gps.addressLoading}
                error={gps.error}
                onAcceptRelaxed={gps.acceptRelaxedAccuracy}
                onContinueSearching={gps.continueSearching}
              />
              {gpsReady && (
                <Button type="button" onClick={openMapFromGps} disabled={disabled} className="w-full">
                  <MapPin className="h-4 w-4" />
                  Otevřít mapu na mé poloze a kreslit
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'address' && (
        <div className="space-y-3">
          <Input
            label="Adresa nebo místo"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Např. Husova 12, Praha 1"
            disabled={disabled || addressSearching}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void searchAddress()
            }}
          />
          <Button
            type="button"
            onClick={() => void searchAddress()}
            loading={addressSearching}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            <Search className="h-4 w-4" />
            Najít na mapě a kreslit
          </Button>
          {addressSearching && (
            <p className="flex items-center gap-2 text-sm text-theme-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Hledám adresu…
            </p>
          )}
          {addressError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {addressError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
