import { Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface FormCheckNextPhasePlaceholderProps {
  onBack: () => void
}

/**
 * Dočasná obrazovka po potvrzení – připravuje navázání OCR a porovnání docházky.
 * Fáze 1 zatím nic neukládá ani nezpracovává.
 */
export function FormCheckNextPhasePlaceholder({ onBack }: FormCheckNextPhasePlaceholderProps) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <h3 className="font-semibold text-theme-primary">Další fáze připravena</h3>
          <p className="mt-2 text-sm text-theme-secondary">
            Formulář byl úspěšně identifikován. V další fázi zde proběhne focení formuláře,
            OCR rozpoznání a porovnání s docházkou. Tyto kroky zatím nejsou implementovány.
          </p>
          <Button variant="secondary" className="mt-6" onClick={onBack}>
            Zpět na skenování
          </Button>
        </div>
      </div>
    </Card>
  )
}
