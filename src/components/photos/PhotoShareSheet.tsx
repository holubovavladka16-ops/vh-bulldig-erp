import { useEffect, useState } from 'react'
import {
  Download,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { buildGpsPhotoSharePreviewUrl } from '@/lib/photos/photoShareImage'
import {
  type PhotoShareChannel,
  type PhotoShareMode,
  resolvePhotoShareFile,
  sharePhotoViaChannel,
  getShareChannelLogName,
} from '@/lib/photos/share'
import type { GpsPhoto } from '@/types/photos'

interface PhotoShareSheetProps {
  open: boolean
  photo: GpsPhoto
  shareMode: PhotoShareMode
  onShareModeChange: (mode: PhotoShareMode) => void
  onClose: () => void
  onShared: (channel: string) => void
}

export function PhotoShareSheet({
  open,
  photo,
  shareMode,
  onShareModeChange,
  onClose,
  onShared,
}: PhotoShareSheetProps) {
  const [preparing, setPreparing] = useState(false)
  const [sharingChannel, setSharingChannel] = useState<PhotoShareChannel | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let objectUrl: string | null = null

    async function prepare() {
      setPreparing(true)
      setError(null)
      setMessage(null)
      setPreviewUrl(null)

      try {
        if (shareMode === 'document') {
          objectUrl = await buildGpsPhotoSharePreviewUrl(photo)
          if (!cancelled) setPreviewUrl(objectUrl)
        } else if (!cancelled) {
          setPreviewUrl(getGpsPhotoUrl(photo.file_path))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Příprava fotodokladu se nezdařila.')
        }
      } finally {
        if (!cancelled) setPreparing(false)
      }
    }

    void prepare()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, photo, shareMode])

  useEffect(() => {
    if (open) return
    setPreviewUrl(null)
    setError(null)
    setMessage(null)
  }, [open])

  if (!open) return null

  async function handleChannel(channel: PhotoShareChannel) {
    setSharingChannel(channel)
    setError(null)
    setMessage(null)

    try {
      const file = await resolvePhotoShareFile(photo, shareMode)
      const result = await sharePhotoViaChannel(file, photo, channel)

      if (result === 'cancelled') return

      if (result === 'shared') {
        onShared(getShareChannelLogName(channel, shareMode))
        setMessage(
          channel === 'other'
            ? 'Fotodoklad sdílen.'
            : 'Vyberte aplikaci v systémovém menu sdílení.',
        )
        if (channel !== 'save') onClose()
        return
      }

      if (result === 'downloaded') {
        onShared(getShareChannelLogName(channel, shareMode))
        setMessage(
          channel === 'save'
            ? 'GPS fotodoklad uložen do telefonu.'
            : 'Soubor stažen – v aplikaci ho přiložte jako obrázek.',
        )
        if (channel === 'save') onClose()
        return
      }

      setError('Sdílení není v tomto prohlížeči podporováno. Použijte „Uložit do telefonu“.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sdílení se nezdařilo.')
    } finally {
      setSharingChannel(null)
    }
  }

  const busy = preparing || sharingChannel != null

  return (
    <div className="modal-overlay z-[80]">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="modal-panel glass-panel scrollbar-premium mx-3 w-full max-w-md p-0 sm:mx-auto"
        role="dialog"
        aria-labelledby="photo-share-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-4 py-3">
          <h2 id="photo-share-title" className="text-base font-bold text-theme-primary">
            Sdílet GPS fotodoklad
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target rounded-lg p-1.5 hover:bg-white/5"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="overflow-hidden rounded-xl border border-[var(--border-glass)] bg-black/40">
            {preparing && shareMode === 'document' ? (
              <div className="flex min-h-[180px] items-center justify-center py-10">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={shareMode === 'document' ? 'Náhled GPS fotodokladu' : 'Originální fotografie'}
                className="max-h-[320px] w-full object-contain"
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-theme-muted">
                Sdílení originální fotografie bez vložených údajů.
              </p>
            )}
          </div>

          <p className="text-center text-[11px] leading-snug text-theme-muted">
            {shareMode === 'document'
              ? 'Informace jsou vložené přímo do obrázku – neztratí se v Messengeru ani WhatsAppu.'
              : 'Originální fotografie bez GPS panelu.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <ShareChannelButton
              label="WhatsApp"
              icon={<MessageCircle className="h-5 w-5" />}
              className="border-emerald-500/40 text-emerald-300"
              disabled={busy}
              loading={sharingChannel === 'whatsapp'}
              onClick={() => void handleChannel('whatsapp')}
            />
            <ShareChannelButton
              label="Messenger"
              icon={<Send className="h-5 w-5" />}
              className="border-blue-500/40 text-blue-300"
              disabled={busy}
              loading={sharingChannel === 'messenger'}
              onClick={() => void handleChannel('messenger')}
            />
            <ShareChannelButton
              label="E-mail"
              icon={<Mail className="h-5 w-5" />}
              className="border-sky-500/40 text-sky-300"
              disabled={busy}
              loading={sharingChannel === 'email'}
              onClick={() => void handleChannel('email')}
            />
            <ShareChannelButton
              label="Další aplikace"
              icon={<MoreHorizontal className="h-5 w-5" />}
              className="border-violet-500/40 text-violet-300"
              disabled={busy}
              loading={sharingChannel === 'other'}
              onClick={() => void handleChannel('other')}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center"
            disabled={busy}
            loading={sharingChannel === 'save'}
            onClick={() => void handleChannel('save')}
          >
            <Download className="h-4 w-4" />
            Uložit do telefonu
          </Button>

          <div className="rounded-xl border border-[var(--border-glass)] bg-white/5 p-1">
            <div className="grid grid-cols-2 gap-1">
              <ModeButton
                active={shareMode === 'document'}
                onClick={() => onShareModeChange('document')}
                label="Sdílet GPS fotodoklad"
              />
              <ModeButton
                active={shareMode === 'original'}
                onClick={() => onShareModeChange('original')}
                label="Sdílet originální fotku"
              />
            </div>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
          {message && <p className="text-center text-xs text-emerald-300">{message}</p>}
        </div>
      </div>
    </div>
  )
}

function ShareChannelButton({
  label,
  icon,
  className,
  disabled,
  loading,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  className: string
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition hover:bg-white/5 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      <span className="text-[10px] font-semibold uppercase">{label}</span>
    </button>
  )
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-2 text-[10px] font-semibold leading-snug transition ${
        active
          ? 'bg-[var(--accent-primary)]/20 text-theme-primary'
          : 'text-theme-muted hover:bg-white/5 hover:text-theme-secondary'
      }`}
    >
      <Share2 className="mx-auto mb-1 h-3.5 w-3.5" />
      {label}
    </button>
  )
}
