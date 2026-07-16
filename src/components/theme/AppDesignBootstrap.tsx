import { useEffect } from 'react'
import { fetchAppDesign } from '@/lib/company/appDesign'
import { getStoredDeviceDesign } from '@/lib/company/deviceDesign'
import { useTheme } from '@/context/ThemeContext'

/** Načte vzhled zařízení (localStorage) nebo firemní výchozí z DB. */
export function AppDesignBootstrap() {
  const { setAppDesign } = useTheme()

  useEffect(() => {
    let cancelled = false

    const stored = getStoredDeviceDesign()
    if (stored) {
      setAppDesign(stored, { persistDevice: false })
      return
    }

    fetchAppDesign().then((design) => {
      if (!cancelled) {
        setAppDesign(design, { persistDevice: false })
      }
    })

    return () => {
      cancelled = true
    }
  }, [setAppDesign])

  return null
}
