import { ExternalLink, FileStack, Printer, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PaperFormDuplicateDialogProps {
  open: boolean
  formNumber?: string | null
  busy?: boolean
  onOpenExisting: () => void
  onReprintExisting: () => void
  onCreateReplacement: () => void
  onCancel: () => void
}

export function PaperFormDuplicateDialog({
  open,
  formNumber,
  busy = false,
  onOpenExisting,
  onReprintExisting,
  onCreateReplacement,
  onCancel,
}: PaperFormDuplicateDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-amber-500/30 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-theme-primary">
              <FileStack className="h-5 w-5 text-amber-400" />
              Formulář za dané období již existuje
            </h3>
            <p className="mt-2 text-sm text-theme-secondary">
              {formNumber
                ? `Aktivní formulář ${formNumber} je již vytvořen pro tohoto zaměstnance a zvolený měsíc.`
                : 'Pro tohoto zaměstnance a zvolený měsíc již existuje aktivní formulář.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-theme-muted hover:bg-white/5"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" loading={busy} onClick={onOpenExisting}>
            <ExternalLink className="h-4 w-4" />
            Otevřít existující formulář
          </Button>
          <Button type="button" variant="secondary" loading={busy} onClick={onReprintExisting}>
            <Printer className="h-4 w-4" />
            Znovu vytisknout existující PDF
          </Button>
          <Button type="button" variant="secondary" loading={busy} onClick={onCreateReplacement}>
            <RefreshCw className="h-4 w-4" />
            Vytvořit náhradní formulář s novým ID a QR kódem
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Zrušit
          </Button>
        </div>
      </div>
    </div>
  )
}
