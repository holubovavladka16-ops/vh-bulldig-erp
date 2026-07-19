import { useCallback, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function useVoiceDictation(onTranscript: (text: string, append: boolean) => void) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => getSpeechRecognition() != null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const recognition = getSpeechRecognition()
    if (!recognition) return

    recognitionRef.current = recognition
    recognition.lang = 'cs-CZ'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onTranscript(transcript, true)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }, [onTranscript])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { listening, supported, toggle, stop, MicIcon: listening ? MicOff : Mic }
}
