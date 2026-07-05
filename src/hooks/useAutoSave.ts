import { useEffect, useRef, useState } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutoSaveOptions<T> {
  data: T | null
  onSave: (data: T) => Promise<void>
  enabled?: boolean
  ready?: boolean
  delay?: number
  localStorageKey?: string
}

export function useAutoSave<T>({
  data,
  onSave,
  enabled = true,
  ready = true,
  delay = 1200,
  localStorageKey,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isFirstRender = useRef(true)
  const wasReady = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (ready && !wasReady.current) {
      isFirstRender.current = true
      wasReady.current = true
    }
  }, [ready])

  useEffect(() => {
    if (!enabled || !ready || data === null) return

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      setStatus('saving')
      setErrorMessage(null)

      if (localStorageKey) {
        localStorage.setItem(localStorageKey, JSON.stringify(data))
      }

      try {
        await onSave(data)
        setStatus('saved')

        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current)
        }
        savedTimeoutRef.current = setTimeout(() => setStatus('idle'), 3500)
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Neznámá chyba ukládání')
        console.error('[useAutoSave]', err)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [data, enabled, ready, delay, onSave, localStorageKey])

  return { status, errorMessage }
}
