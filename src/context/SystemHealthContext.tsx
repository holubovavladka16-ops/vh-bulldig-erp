import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { runSystemHealthCheck, type SystemHealthReport } from '@/lib/auth/systemHealth'

interface SystemHealthContextType {
  report: SystemHealthReport | null
  loading: boolean
  recheck: () => Promise<SystemHealthReport>
}

const SystemHealthContext = createContext<SystemHealthContextType | undefined>(undefined)

export function SystemHealthProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<SystemHealthReport | null>(null)
  const [loading, setLoading] = useState(false)

  const recheck = useCallback(async () => {
    setLoading(true)
    try {
      const next = await runSystemHealthCheck()
      setReport(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const runDeferred = () => {
      void recheck()
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(runDeferred, { timeout: 4000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = globalThis.setTimeout(runDeferred, 1500)
    return () => globalThis.clearTimeout(timeoutId)
  }, [recheck])

  return (
    <SystemHealthContext.Provider value={{ report, loading, recheck }}>
      {children}
    </SystemHealthContext.Provider>
  )
}

export function useSystemHealth() {
  const context = useContext(SystemHealthContext)
  if (!context) {
    throw new Error('useSystemHealth musí být použit uvnitř SystemHealthProvider')
  }
  return context
}
