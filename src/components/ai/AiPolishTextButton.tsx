import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { polishTextWithAi, type AiPolishContext } from '@/lib/ai/geminiPolish'

interface AiPolishTextButtonProps {
  sourceText: string
  context: AiPolishContext
  onPolished: (text: string) => void
  onError?: (message: string) => void
  portalToken?: string
  disabled?: boolean
  className?: string
  minLength?: number
}

export function AiPolishTextButton({
  sourceText,
  context,
  onPolished,
  onError,
  portalToken,
  disabled,
  className,
  minLength = 8,
}: AiPolishTextButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const result = await polishTextWithAi(sourceText, context, { portalToken })
      onPolished(result.polished_text)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Oprava textu pomocí AI se nezdařila.'
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const trimmed = sourceText.trim()

  return (
    <Button
      type="button"
      variant="secondary"
      className={className ?? 'w-full sm:w-auto'}
      loading={loading}
      disabled={disabled || loading || trimmed.length < minLength}
      onClick={() => void handleClick()}
    >
      <Sparkles className="h-4 w-4" />
      Opravit text pomocí AI
    </Button>
  )
}
