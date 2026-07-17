import { Calendar, FileText, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { FormCheckContext } from '@/types/formCheck'

interface FormCheckConfirmScreenProps {
  context: FormCheckContext
  continuing?: boolean
  onContinue: () => void
  onCancel: () => void
}

export function FormCheckConfirmScreen({
  context,
  continuing = false,
  onContinue,
  onCancel,
}: FormCheckConfirmScreenProps) {
  return (
    <Card>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-theme-primary">Potvrzení formuláře</h3>
        <p className="mt-1 text-sm text-theme-secondary">
          Zkontrolujte údaje načtené z QR kódu a pokračujte, nebo skenování zrušte.
        </p>
      </div>

      <dl className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
          <User className="mt-0.5 h-5 w-5 shrink-0 text-theme-secondary" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-theme-secondary">Jméno zaměstnance</dt>
            <dd className="mt-1 text-base font-medium text-theme-primary">{context.workerName}</dd>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-theme-secondary" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-theme-secondary">Číslo formuláře</dt>
            <dd className="mt-1 text-base font-medium text-theme-primary">{context.formNumber}</dd>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-theme-secondary" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-theme-secondary">Měsíc</dt>
            <dd className="mt-1 text-base font-medium text-theme-primary">{context.periodLabel}</dd>
          </div>
        </div>
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={continuing}>
          Zrušit
        </Button>
        <Button size="lg" onClick={onContinue} loading={continuing}>
          Pokračovat
        </Button>
      </div>
    </Card>
  )
}
