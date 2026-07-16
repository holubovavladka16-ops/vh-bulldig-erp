/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react'

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<{ [index: number]: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useVoiceDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor()
    setSupported(Boolean(SpeechRecognitionCtor))
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'cs-CZ'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onText(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [onText])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (listening) {
      recognition.stop()
      setListening(false)
      return
    }
    recognition.start()
    setListening(true)
  }, [listening])

  return { supported, listening, toggle }
}
