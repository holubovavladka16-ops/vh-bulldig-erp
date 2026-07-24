import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface FormCheckOcrProcessingProps {
  previewUrl?: string | null
}

export function FormCheckOcrProcessing({ previewUrl }: FormCheckOcrProcessingProps) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--accent-primary,#06b6d4)]" />
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">Zpracování OCR</h3>
          <p className="mt-2 text-sm text-theme-secondary">
            Nahrávám fotografii do úložiště a odesílám ji do Gemini Vision pro rozpoznání údajů
            z formuláře…
          </p>
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Náhled formuláře"
            className="mt-2 max-h-48 w-full rounded-xl border border-[var(--border-glass)] object-contain opacity-70"
          />
        )}
      </div>
    </Card>
  )
}
