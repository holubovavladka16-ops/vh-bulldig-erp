import { Archive, Check, Eye, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FOTO_APPROVAL_LABELS } from '@/constants/fotodokumentace'
import type { FotoApprovalStatus, FotoDokument } from '@/types/fotodokumentace'

interface FotoSchvaleniAkceProps {
  foto: FotoDokument
  busy?: boolean
  onAction: (status: FotoApprovalStatus, reason?: string) => void
}

export function FotoSchvaleniAkce({ foto, busy, onAction }: FotoSchvaleniAkceProps) {
  const status = foto.approval_status

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">
        Schvalování · aktuálně: {FOTO_APPROVAL_LABELS[status]}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {status !== 'ke_kontrole' && (
          <Button variant="secondary" size="sm" className="justify-center" disabled={busy} onClick={() => onAction('ke_kontrole')}>
            <Eye className="h-4 w-4" />
            Ke kontrole
          </Button>
        )}
        {status !== 'schvalena' && (
          <Button variant="primary" size="sm" className="justify-center" disabled={busy} onClick={() => onAction('schvalena')}>
            <Check className="h-4 w-4" />
            Schválit
          </Button>
        )}
        {status !== 'zamitnuta' && (
          <Button variant="secondary" size="sm" className="justify-center" disabled={busy} onClick={() => {
            const reason = prompt('Důvod zamítnutí:') ?? undefined
            onAction('zamitnuta', reason)
          }}>
            <X className="h-4 w-4" />
            Zamítnout
          </Button>
        )}
        {status !== 'archivovana' && (
          <Button variant="secondary" size="sm" className="justify-center" disabled={busy} onClick={() => onAction('archivovana')}>
            <Archive className="h-4 w-4" />
            Archivovat
          </Button>
        )}
        {status !== 'nova' && (
          <Button variant="secondary" size="sm" className="justify-center" disabled={busy} onClick={() => onAction('nova')}>
            <RotateCcw className="h-4 w-4" />
            Vrátit na novou
          </Button>
        )}
      </div>
    </div>
  )
}
