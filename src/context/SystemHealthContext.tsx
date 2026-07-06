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
  const [loading, setLoading] = useState(true)

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
    void recheck()
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
