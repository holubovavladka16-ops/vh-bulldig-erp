import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Images, Trash2 } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { FormPhotoLightbox } from '@/components/portal/field/FormPhotoLightbox'

interface FieldModePhotoSectionProps {
  photos: File[]
  onChange: (photos: File[]) => void
  disabled?: boolean
}

export function FieldModePhotoSection({ photos, onChange, disabled }: FieldModePhotoSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const previewUrls = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  )

  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [previewUrls])

  function addPhotos(files: FileList | null) {
    if (!files?.length) return
    onChange([...photos, ...Array.from(files)])
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index))
    if (lightboxIndex != null && lightboxIndex >= index) {
      setLightboxIndex(null)
    }
  }

  return (
    <FieldModeCard title="Fotodokumentace" icon="📷" className="field-mode-grid__full">
      <div className="field-mode-photo-actions">
        {!disabled && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                addPhotos(e.target.files)
                e.target.value = ''
              }}
            />
            <button type="button" className="field-mode-btn-capture" onClick={() => inputRef.current?.click()}>
              <Camera className="h-5 w-5" />
              Vyfotit
            </button>
            <button type="button" className="field-mode-btn-secondary" onClick={() => inputRef.current?.click()}>
              <Images className="h-4 w-4" />
              Přidat další
            </button>
          </>
        )}
        {photos.length > 0 && (
          <button
            type="button"
            className="field-mode-btn-secondary"
            onClick={() => setLightboxIndex(0)}
          >
            <Images className="h-4 w-4" />
            Otevřít galerii
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-theme-muted">Zatím žádné fotografie k výkazu.</p>
      ) : (
        <div className="field-mode-photo-strip mt-3">
          {previewUrls.map((url, index) => (
            <div key={`${photos[index]?.name}-${index}`} className="field-mode-photo-strip__item">
              <button type="button" className="field-mode-photo-strip__thumb" onClick={() => setLightboxIndex(index)}>
                <img src={url} alt={photos[index]?.name ?? `Foto ${index + 1}`} loading="lazy" />
              </button>
              {!disabled && (
                <button
                  type="button"
                  className="field-mode-photo-strip__delete"
                  onClick={() => removePhoto(index)}
                  aria-label="Smazat fotografii"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex != null && (
        <FormPhotoLightbox urls={previewUrls} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </FieldModeCard>
  )
}
