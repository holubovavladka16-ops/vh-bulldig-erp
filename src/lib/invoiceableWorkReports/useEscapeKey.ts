import { useEffect } from 'react'

/** Zavře dialog/modal po stisknutí klávesy Escape. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onEscape])
}
