import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FOTO_SYNC_LABELS } from '@/constants/fotodokumentace'
import { nacistOfflineFrontu } from '@/lib/fotodokumentace/offlineQueue'
import type { FotoOfflineZaznam } from '@/types/fotodokumentace'

interface FotoOfflineBannerProps {
  onSync?: () => void
}

export function FotoOfflineBanner({ onSync }: FotoOfflineBannerProps) {
  const [fronta, setFronta] = useState<FotoOfflineZaznam[]>([])
  const [online, setOnline] = useState(navigator.onLine)

  async function refresh() {
    setFronta(await nacistOfflineFrontu())
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(refresh, 5000)
    const onOnline = () => {
      setOnline(true)
      void refresh()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const pending = fronta.filter((z) => z.status === 'pending' || z.status === 'error')
  if (!online && pending.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <CloudOff className="h-4 w-4 shrink-0" />
        Jste offline – nové fotografie se uloží do fronty a synchronizují po připojení.
      </div>
    )
  }

  if (pending.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-[var(--border-glass)] bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-theme-primary">
          <Upload className="h-4 w-4" />
          Offline fronta ({pending.length})
        </p>
        <Button size="sm" variant="secondary" onClick={() => { onSync?.(); void refresh() }}>
          <RefreshCw className="h-4 w-4" />
          Synchronizovat
        </Button>
      </div>
      <ul className="space-y-1 text-xs text-theme-muted">
        {pending.slice(0, 5).map((z) => (
          <li key={z.localId} className="flex justify-between gap-2">
            <span>{new Date(z.createdAt).toLocaleString('cs-CZ')}</span>
            <span className={z.status === 'error' ? 'text-red-400' : ''}>
              {FOTO_SYNC_LABELS[z.status]}
              {z.errorMessage ? `: ${z.errorMessage}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
