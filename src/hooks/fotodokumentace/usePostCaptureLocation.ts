import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FOTO_GPS_ACCEPTABLE_METERS,
  FOTO_GPS_TARGET_METERS,
  nacistAdresuZPolohy,
  nacistPolohuAAdresu,
  nacistPolohuPoFoto,
} from '@/lib/fotodokumentace/geolocation'
import type { FotoAdresa, FotoPoloha } from '@/types/fotodokumentace'

export type FotoGpsFaze =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'low_accuracy'
  | 'error'

function resolveFaze(poloha: FotoPoloha, presnostOk: boolean): FotoGpsFaze {
  if (presnostOk) return 'ready'
  if (poloha.accuracy <= FOTO_GPS_ACCEPTABLE_METERS) return 'ready'
  return 'low_accuracy'
}

export function usePostCaptureLocation(active: boolean) {
  const [faze, setFaze] = useState<FotoGpsFaze>('idle')
  const [poloha, setPoloha] = useState<FotoPoloha | null>(null)
  const [adresa, setAdresa] = useState<FotoAdresa | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [chyba, setChyba] = useState<string | null>(null)
  const [manualAdresa, setManualAdresa] = useState('')
  const [presnostOk, setPresnostOk] = useState(false)
  const startedRef = useRef(false)

  const start = useCallback(async () => {
    setFaze('loading')
    setChyba(null)
    setPoloha(null)
    setAdresa(null)
    setPresnostOk(false)

    const vysledek = await nacistPolohuAAdresu((acc) => setAccuracy(acc))
    if (vysledek.poloha && vysledek.adresa) {
      setPoloha(vysledek.poloha)
      setAdresa(vysledek.adresa)
      setAccuracy(vysledek.poloha.accuracy)
      setPresnostOk(vysledek.presnostOk)
      setFaze(resolveFaze(vysledek.poloha, vysledek.presnostOk))
    } else {
      setChyba(vysledek.chyba)
      setFaze('error')
    }
  }, [])

  useEffect(() => {
    if (!active) {
      startedRef.current = false
      setFaze('idle')
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    void start()
  }, [active, start])

  const retry = useCallback(() => {
    startedRef.current = true
    void start()
  }, [start])

  const acceptLowAccuracy = useCallback(() => {
    if (poloha) setFaze('ready')
  }, [poloha])

  const setManualAddress = useCallback((text: string) => {
    setManualAdresa(text)
    setAdresa({
      address_full: text,
      street: '',
      city: '',
      postal_code: '',
      district: '',
      region: '',
      country: 'Česko',
    })
    setFaze('ready')
  }, [])

  const saveWithoutGps = useCallback(() => {
    setPoloha(null)
    setPresnostOk(false)
    setAdresa({
      address_full: manualAdresa || '',
      street: '',
      city: '',
      postal_code: '',
      district: '',
      region: '',
      country: 'Česko',
    })
    setFaze('ready')
  }, [manualAdresa])

  const resolveAdresa = useCallback((): FotoAdresa => {
    if (adresa) return adresa
    return {
      address_full: manualAdresa,
      street: '',
      city: '',
      postal_code: '',
      district: '',
      region: '',
      country: 'Česko',
    }
  }, [adresa, manualAdresa])

  const gpsStatus = poloha
    ? presnostOk
      ? 'verified'
      : 'unverified'
    : manualAdresa
      ? 'manual'
      : 'missing'

  const canSave = faze === 'ready' || faze === 'error'

  return {
    faze,
    poloha,
    adresa,
    accuracy,
    chyba,
    manualAdresa,
    setManualAdresa,
    setManualAddress,
    saveWithoutGps,
    retry,
    acceptLowAccuracy,
    resolveAdresa,
    presnostOk,
    gpsStatus,
    canSave,
    targetMeters: FOTO_GPS_TARGET_METERS,
  }
}

export { nacistPolohuPoFoto, nacistAdresuZPolohy as doplnitAdresu }
