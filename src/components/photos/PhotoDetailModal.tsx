import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { formatDate } from '@/constants/workers'
import {
  deleteGpsPhoto,
  fetchGpsPhotoDetail,
  getGpsPhotoUrl,
  updateGpsPhotoNote,
} from '@/lib/photos/api'
import { getOpenStreetMapEmbedUrl, getStreetViewEmbedUrl, getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { PhotoDeleteButton, PhotoNoteEditor, PhotoShareButtons } from '@/components/photos/PhotoShareButtons'
import type { GpsPhotoDetail } from '@/types/photos'

interface PhotoDetailModalProps {
  photoId: string | null
  onClose: () => void
  onUpdated: () => void
}

export function PhotoDetailModal({ photoId, onClose, onUpdated }: PhotoDetailModalProps) {
  const { user, profile } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const [detail, setDetail] = useState<GpsPhotoDetail | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!photoId) return
    setLoading(true)
    fetchGpsPhotoDetail(photoId)
      .then((data) => {
        setDetail(data)
        setNote(data?.note ?? '')
      })
      .finally(() => setLoading(false))
  }, [photoId])

  if (!photoId) return null

  async function reload() {
    if (!photoId) return
    const data = await fetchGpsPhotoDetail(photoId)
    setDetail(data)
    setNote(data?.note ?? '')
    onUpdated()
  }

  async function handleSaveNote() {
    if (!photoId || !user) return
    setSavingNote(true)
    try {
      await updateGpsPhotoNote(photoId, note, user.id)
      await reload()
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDelete() {
    if (!detail || !user || !confirm('Smazat tuto fotografii?')) return
    setDeleting(true)
    try {
      await deleteGpsPhoto(detail.id, detail.file_path, user.id)
      onUpdated()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-2xl glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Detail fotografie</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <img src={getGpsPhotoUrl(detail.file_path)} alt={detail.file_name} className="w-full rounded-xl neon-border object-contain" />

              <div className="mt-4 grid gap-2 text-sm">
                <Info label="Datum" value={formatDate(detail.captured_date)} />
                <Info label="Čas" value={detail.captured_time.slice(0, 5)} />
                <Info label="GPS" value={`${detail.gps_lat.toFixed(6)}, ${detail.gps_lng.toFixed(6)}`} />
                <Info
                  label="Přesnost GPS"
                  value={
                    detail.gps_accuracy != null
                      ? `±${Math.round(detail.gps_accuracy)} m`
                      : '—'
                  }
                />
                <Info label="Adresa" value={detail.address_full} />
                <Info label="Ulice" value={detail.street || '—'} />
                <Info label="Město" value={detail.city || '—'} />
                <Info label="PSČ" value={detail.postal_code || '—'} />
                <Info label="Stát" value={detail.country || '—'} />
                {detail.order_name && <Info label="Zakázka" value={detail.order_name} />}
                {detail.worker_name && <Info label="Zaměstnanec" value={detail.worker_name} />}
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <h3 className="mb-3 font-semibold text-theme-primary">Mapa</h3>
                <iframe
                  title="Mapa"
                  src={getOpenStreetMapEmbedUrl(detail.gps_lat, detail.gps_lng)}
                  className="h-56 w-full rounded-xl border border-[var(--border-glass)]"
                  loading="lazy"
                />
                <a href={getGoogleMapsUrl(detail.gps_lat, detail.gps_lng)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-accent hover:underline">
                  Otevřít v Google Maps
                </a>
              </Card>

              <Card>
                <h3 className="mb-3 font-semibold text-theme-primary">Pohled z ulice</h3>
                <iframe
                  title="Pohled z ulice"
                  src={getStreetViewEmbedUrl(detail.gps_lat, detail.gps_lng)}
                  className="h-56 w-full rounded-xl border border-[var(--border-glass)]"
                  loading="lazy"
                />
                <a href={getStreetViewUrl(detail.gps_lat, detail.gps_lng)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-accent hover:underline">
                  Otevřít pohled z ulice
                </a>
              </Card>

              {user && (
                <Card>
                  <h3 className="mb-3 font-semibold text-theme-primary">Poznámka a sdílení</h3>
                  <PhotoNoteEditor note={note} onChange={setNote} onSave={handleSaveNote} saving={savingNote} />
                  <div className="mt-4 border-t border-[var(--border-glass)] pt-4">
                    <PhotoShareButtons photo={detail} userId={user.id} note={note} onShared={reload} />
                  </div>
                </Card>
              )}

              <Card>
                <h3 className="mb-3 font-semibold text-theme-primary">Historie</h3>
                {detail.history.length === 0 ? (
                  <p className="text-sm text-theme-muted">Zatím žádná historie.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.history.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-[var(--border-glass)] px-3 py-2 text-sm">
                        <p className="font-medium text-theme-primary">{entry.action}</p>
                        <p className="text-xs text-theme-muted">{formatDate(entry.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {isAdmin && user && (
                <PhotoDeleteButton onDelete={handleDelete} loading={deleting} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-20 text-theme-muted">{label}:</span>
      <span className="text-theme-primary">{value}</span>
    </div>
  )
}
