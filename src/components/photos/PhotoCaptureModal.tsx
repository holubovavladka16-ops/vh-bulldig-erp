import { X } from 'lucide-react'
import { PhotoCaptureFlow } from '@/components/photos/PhotoCaptureFlow'

interface PhotoCaptureModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  uploadedBy: string
  creatorName: string
  constructionPointId?: string
  defaultOrderId?: string
  lockOrder?: boolean
}

export function PhotoCaptureModal({
  open,
  onClose,
  onCreated,
  uploadedBy,
  creatorName,
  constructionPointId,
  defaultOrderId,
  lockOrder = false,
}: PhotoCaptureModalProps) {
  if (!open) return null

  function handleCreated() {
    onCreated()
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium p-0 sm:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-glass)] bg-[var(--bg-glass)]/95 px-4 py-3 backdrop-blur-md">
          <h2 className="text-lg font-bold text-theme-primary">
            {constructionPointId ? 'Přidat fotografii ke stavebnímu bodu' : 'Nová GPS fotografie'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target rounded-lg p-1.5 hover:bg-white/5"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <PhotoCaptureFlow
            active={open}
            uploadedBy={uploadedBy}
            creatorName={creatorName}
            constructionPointId={constructionPointId}
            defaultOrderId={defaultOrderId}
            lockOrder={lockOrder}
            onCreated={handleCreated}
            compact
          />
        </div>
      </div>
    </div>
  )
}
