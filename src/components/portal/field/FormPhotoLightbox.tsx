import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface FormPhotoLightboxProps {
  urls: string[]
  initialIndex: number
  onClose: () => void
}

export function FormPhotoLightbox({ urls, initialIndex, onClose }: FormPhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    setIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(urls.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, urls.length])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const url = urls[index]
  if (!url) return null

  return (
    <div className="field-mode-lightbox" role="dialog" aria-modal="true">
      <button type="button" className="field-mode-lightbox__close" onClick={onClose} aria-label="Zavřít">
        <X className="h-6 w-6" />
      </button>
      <img
        src={url}
        alt={`Fotografie ${index + 1}`}
        onTouchStart={(e) => {
          const touch = e.changedTouches[0]?.clientX
          if (touch == null) return
          ;(e.currentTarget as HTMLImageElement).dataset.touchStart = String(touch)
        }}
        onTouchEnd={(e) => {
          const start = Number((e.currentTarget as HTMLImageElement).dataset.touchStart)
          const end = e.changedTouches[0]?.clientX
          if (!start || end == null) return
          const delta = end - start
          if (Math.abs(delta) > 48) {
            setIndex((i) => (delta > 0 ? Math.max(0, i - 1) : Math.min(urls.length - 1, i + 1)))
          }
        }}
      />
      <p className="absolute bottom-6 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
        {index + 1} / {urls.length}
      </p>
    </div>
  )
}
