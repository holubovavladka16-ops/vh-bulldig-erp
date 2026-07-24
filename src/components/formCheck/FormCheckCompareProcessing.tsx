import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export function FormCheckCompareProcessing() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--accent-primary,#06b6d4)]" />
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">Porovnávám s docházkou</h3>
          <p className="mt-2 text-sm text-theme-secondary">
            Načítám záznamy docházky z ERP a porovnávám je s údaji z OCR formuláře…
          </p>
        </div>
      </div>
    </Card>
  )
}
