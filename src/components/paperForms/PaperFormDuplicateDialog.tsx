import { ExternalLink, FilePlus2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PaperFormDuplicateDialogProps {
  open: boolean
  formNumber?: string | null
  loading?: boolean
  onOpenExisting: () => void
  onReprint: () => void
  onCreateReplacement: () => void
  onCancel: () => void
}

export function PaperFormDuplicateDialog({
  open,
  formNumber,
  loading = false,
  onOpenExisting,
  onReprint,
  onCreateReplacement,
  onCancel,
}: PaperFormDuplicateDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-amber-500/30 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-theme-primary">Formulář pro tento měsíc již existuje</h2>
            <p className="mt-2 text-sm text-theme-secondary">
              Dělník už formulář má za daný měsíc
              {formNumber ? ` (${formNumber})` : ''}. Vyberte, jak chcete pokračovat.
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
          <Button variant="secondary" loading={loading} onClick={onOpenExisting}>
            <ExternalLink className="h-4 w-4" />
            Otevřít existující formulář
          </Button>
          <Button variant="secondary" loading={loading} onClick={onReprint}>
            <Printer className="h-4 w-4" />
            Znovu vytisknout existující PDF
          </Button>
          <Button loading={loading} onClick={onCreateReplacement}>
            <FilePlus2 className="h-4 w-4" />
            Vytvořit náhradní formulář s novým ID a QR kódem
          </Button>
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            Zrušit
          </Button>
        </div>
      </div>
    </div>
  )
}
