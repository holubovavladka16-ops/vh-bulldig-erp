import { AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { FormCheckError } from '@/types/formCheck'

interface FormCheckErrorPanelProps {
  error: FormCheckError
  onDismiss?: () => void
}

export function FormCheckErrorPanel({ error, onDismiss }: FormCheckErrorPanelProps) {
  return (
    <Card className="border-red-500/30 bg-red-500/10" padding>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-300">Chyba</p>
          <p className="mt-1 text-sm text-red-200/90">{error.message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-3 text-sm text-red-300 underline hover:text-red-200"
            >
              Zkusit znovu
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
