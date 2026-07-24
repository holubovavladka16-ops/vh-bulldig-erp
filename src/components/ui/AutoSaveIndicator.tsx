import { Check, Loader2, AlertCircle } from 'lucide-react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: SaveStatus
  errorMessage?: string | null
  successMessage?: string
}

export function AutoSaveIndicator({
  status,
  errorMessage,
  successMessage = 'Změny byly úspěšně uloženy.',
}: AutoSaveIndicatorProps) {
  if (status === 'idle') return null

  const isError = status === 'error'
  const isSaved = status === 'saved'

  return (
    <div
      className={`
        autosave-indicator max-w-full rounded-xl px-3 py-2 text-xs font-medium
        glass-panel neon-border
        ${isError ? 'border-red-500/30 text-red-300' : isSaved ? 'border-green-500/30 text-green-300' : 'text-theme-secondary'}
      `}
    >
      <div className="flex items-start gap-2">
        {status === 'saving' && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin icon-neon" />}
        {isSaved && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />}
        {isError && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <div className="min-w-0 break-words">
          {status === 'saving' && 'Ukládání…'}
          {isSaved && successMessage}
          {isError && (errorMessage || 'Chyba ukládání')}
        </div>
      </div>
    </div>
  )
}
