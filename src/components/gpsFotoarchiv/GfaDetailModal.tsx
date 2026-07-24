import { useEffect, useState } from 'react'
import { ExternalLink, History, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { getGoogleMapsUrl, getMapyCzShowMapUrl } from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsLocationLabel,
  formatPhotoAddress,
  getOrderDisplayName,
  getPhotoAuthorName,
} from '@/lib/photos/photoDisplay'
import {
  fetchDiaryEntryOptions,
  loadArchivePhotoDetail,
  removeArchivePhoto,
  updateArchivePhoto,
} from '@/lib/gpsFotoarchiv/service'
import { exportArchivePhotosPdf } from '@/lib/gpsFotoarchiv/pdfExport'
import { GfaShareActions } from '@/components/gpsFotoarchiv/GfaShareActions'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { formatDateTime } from '@/constants/workers'
import type { GpsPhotoDetail } from '@/types/photos'

interface GfaDetailModalProps {
  photoId: string | null
  orderOptions: { value: string; label: string }[]
  userId: string
  isAdmin: boolean
  onClose: () => void
  onUpdated: () => void
}

export function GfaDetailModal({
  photoId,
  orderOptions,
  userId,
  isAdmin,
  onClose,
  onUpdated,
}: GfaDetailModalProps) {
  const { settings } = useCompanySettings()
  const [detail, setDetail] = useState<GpsPhotoDetail | null>(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [orderId, setOrderId] = useState('')
  const [diaryEntryId, setDiaryEntryId] = useState('')
  const [diaryOptions, setDiaryOptions] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!photoId) {
      setDetail(null)
      return
    }
    setLoading(true)
    loadArchivePhotoDetail(photoId)
      .then((data) => {
        setDetail(data)
        setTitle(data.title ?? '')
        setNote(data.note ?? '')
        setOrderId(data.order_id ?? '')
        setDiaryEntryId(data.diary_entry_id ?? '')
      })
      .finally(() => setLoading(false))
  }, [photoId])

  useEffect(() => {
    if (!orderId) {
      setDiaryOptions([])
      return
    }
    fetchDiaryEntryOptions(orderId)
      .then(setDiaryOptions)
      .catch(() => setDiaryOptions([]))
  }, [orderId])

  if (!photoId) return null

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    try {
      await updateArchivePhoto(
        detail.id,
        {
          title: title.trim() || null,
          note: note.trim() || null,
          order_id: orderId || null,
          diary_entry_id: diaryEntryId || null,
        },
        userId
      )
      onUpdated()
      const refreshed = await loadArchivePhotoDetail(detail.id)
      setDetail(refreshed)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!detail || !confirm('Smazat tuto fotografii?')) return
    await removeArchivePhoto(detail.id, detail.file_path, userId)
    onUpdated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Detail fotografie</h2>
            {detail && (
              <p className="text-sm text-[var(--text-muted)]">
                {formatCaptureDateLabel(detail.captured_date)} {formatCaptureTime(detail.captured_time)}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zavřít">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {loading && <p className="text-sm text-[var(--text-muted)]">Načítám…</p>}

        {detail && (
          <div className="space-y-4">
            <img
              src={getGpsPhotoUrl(detail.file_path)}
              alt={detail.title ?? 'Fotografie'}
              className="max-h-80 w-full rounded-xl object-contain"
            />

            <div className="grid gap-2 text-sm">
              <p>
                <strong>Adresa:</strong>{' '}
                <a href={getMapyCzShowMapUrl(detail.gps_lat, detail.gps_lng)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                  {formatPhotoAddress(detail)}
                </a>
              </p>
              <p>
                <strong>GPS:</strong>{' '}
                <a href={getGoogleMapsUrl(detail.gps_lat, detail.gps_lng)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                  {formatGpsLocationLabel(detail.gps_lat, detail.gps_lng, detail.gps_accuracy)}
                </a>
              </p>
              <p><strong>Zakázka:</strong> {getOrderDisplayName(detail)}</p>
              <p><strong>Autor:</strong> {getPhotoAuthorName(detail)}</p>
              {detail.device_info && <p><strong>Zařízení:</strong> {detail.device_info}</p>}
            </div>

            {isAdmin && (
              <div className="space-y-3 rounded-xl border border-[var(--border-glass)] p-3">
                <Input label="Název fotografie" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Input label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} />
                <Select
                  label="Zakázka"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  options={[{ value: '', label: '—' }, ...orderOptions]}
                />
                <Select
                  label="Stavební deník"
                  value={diaryEntryId}
                  onChange={(e) => setDiaryEntryId(e.target.value)}
                  options={[{ value: '', label: 'Bez zápisu' }, ...diaryOptions]}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleSave()} loading={saving}>
                    Uložit změny
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void exportArchivePhotosPdf([detail], settings)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button variant="danger" onClick={() => void handleDelete()}>
                    <Trash2 className="h-4 w-4" />
                    Smazat
                  </Button>
                </div>
              </div>
            )}

            <GfaShareActions photo={detail} />

            {detail.history.length > 0 && (
              <div className="rounded-xl border border-[var(--border-glass)] p-3">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" />
                  Historie změn
                </h3>
                <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                  {detail.history.map((entry) => (
                    <li key={entry.id}>
                      <span className="text-[var(--text-primary)]">{entry.action}</span>
                      {' · '}
                      {formatDateTime(entry.created_at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
