import { useCallback, useEffect, useRef, useState } from 'react'
import {
  nacistAdresuZPolohy,
  nacistPolohuAAdresu,
  nacistPolohuPoFoto,
} from '@/lib/fotodokumentace/geolocation'
import type { FotoAdresa, FotoPoloha } from '@/types/fotodokumentace'

export type FotoGpsFaze = 'idle' | 'loading' | 'ready' | 'error'

export function usePostCaptureLocation(active: boolean) {
  const [faze, setFaze] = useState<FotoGpsFaze>('idle')
  const [poloha, setPoloha] = useState<FotoPoloha | null>(null)
  const [adresa, setAdresa] = useState<FotoAdresa | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [chyba, setChyba] = useState<string | null>(null)
  const [manualAdresa, setManualAdresa] = useState('')
  const startedRef = useRef(false)

  const start = useCallback(async () => {
    setFaze('loading')
    setChyba(null)
    setPoloha(null)
    setAdresa(null)

    const vysledek = await nacistPolohuAAdresu((acc) => setAccuracy(acc))
    if (vysledek.poloha) {
      setPoloha(vysledek.poloha)
      setAdresa(vysledek.adresa)
      setFaze('ready')
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
    resolveAdresa,
    gpsStatus: poloha ? 'verified' : manualAdresa ? 'manual' : 'missing',
  }
}

export async function nacistPolohuZnovu(): Promise<FotoPoloha> {
  return nacistPolohuPoFoto()
}

export async function doplnitAdresu(lat: number, lng: number): Promise<FotoAdresa> {
  return nacistAdresuZPolohy(lat, lng)
}
