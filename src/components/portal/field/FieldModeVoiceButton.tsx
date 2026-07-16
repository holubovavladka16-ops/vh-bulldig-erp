import { useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useVoiceDictation } from '@/components/portal/field/useVoiceDictation'

interface FieldModeVoiceButtonProps {
  onDictation: (text: string) => void
  disabled?: boolean
}

export function FieldModeVoiceButton({ onDictation, disabled }: FieldModeVoiceButtonProps) {
  const append = useCallback(
    (text: string) => {
      onDictation(text)
    },
    [onDictation]
  )
  const { supported, listening, toggle } = useVoiceDictation(append)

  if (!supported) return null

  return (
    <button
      type="button"
      className={`field-mode-voice-btn ${listening ? 'field-mode-voice-btn--active' : ''}`}
      onClick={toggle}
      disabled={disabled}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {listening ? 'Nahrávám… klepněte pro ukončení' : 'Diktovat hlasem'}
    </button>
  )
}
