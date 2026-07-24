import { Button } from '@/components/ui/Button'
import { useEscapeKey } from '@/lib/invoiceableWorkReports/useEscapeKey'

interface InvoiceableConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Potvrzovací dialog ve stejném vizuálním stylu jako zbytek modulu – náhrada za nativní confirm(). */
export function InvoiceableConfirmDialog({
  title,
  message,
  confirmLabel = 'Potvrdit',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: InvoiceableConfirmDialogProps) {
  useEscapeKey(onClose)

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel glass-panel neon-border">
        <h2 className="mb-2 text-lg font-bold text-theme-primary">{title}</h2>
        <p className="text-sm text-theme-secondary">{message}</p>

        <div className="modal-footer pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Zrušit
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
