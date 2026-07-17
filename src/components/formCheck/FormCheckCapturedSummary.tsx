import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { FormCheckContext } from '@/types/formCheck'

interface FormCheckCapturedSummaryProps {
  context: FormCheckContext
  previewUrl: string
  onRetake: () => void
  onBackToScan: () => void
}

/**
 * Shrnutí po potvrzení fotografie – připraveno pro navázání OCR ve Fázi 3.
 */
export function FormCheckCapturedSummary({
  context,
  previewUrl,
  onRetake,
  onBackToScan,
}: FormCheckCapturedSummaryProps) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
        <div>
          <h3 className="font-semibold text-theme-primary">Fotografie formuláře pořízena</h3>
          <p className="mt-1 text-sm text-theme-secondary">
            Formulář {context.formNumber} ({context.workerName}, {context.periodLabel}) je připraven
            pro další fázi OCR. Rozpoznávání textu zatím není implementováno.
          </p>
        </div>
      </div>

      <img
        src={previewUrl}
        alt={`Fotografie formuláře ${context.formNumber}`}
        className="mx-auto max-h-64 w-full rounded-xl border border-[var(--border-glass)] object-contain"
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBackToScan}>
          Nové skenování
        </Button>
        <Button variant="secondary" onClick={onRetake}>
          Znovu vyfotit
        </Button>
      </div>
    </Card>
  )
}
