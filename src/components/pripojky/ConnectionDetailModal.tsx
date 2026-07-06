import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchUtilityConnectionDetail } from '@/lib/pripojky/api'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { PHOTO_PHASE_LABELS, WORK_TYPE_OPTIONS } from '@/types/pripojky'
import type { UtilityConnectionDetail } from '@/types/pripojky'
import { formatDate } from '@/constants/workers'

interface ConnectionDetailModalProps {
  connectionId: string | null
  onClose: () => void
}

export function ConnectionDetailModal({ connectionId, onClose }: ConnectionDetailModalProps) {
  const [detail, setDetail] = useState<UtilityConnectionDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!connectionId) return
    setLoading(true)
    fetchUtilityConnectionDetail(connectionId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [connectionId])

  if (!connectionId) return null

  const workTypeLabel = WORK_TYPE_OPTIONS.find((o) => o.value === detail?.work_type)?.label ?? detail?.work_type

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Detail přípojky</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : !detail ? (
          <p className="py-16 text-center text-theme-secondary">Přípojka nenalezena nebo byla smazána.</p>
        ) : (
          <div className="space-y-6">
            <Card className="grid gap-3 sm:grid-cols-2">
              <Info label="Datum" value={formatDate(detail.connection_date)} />
              <Info label="Zakázka" value={detail.order_name ?? '—'} />
              <Info label="Zaměstnanec" value={detail.worker_name ?? '—'} />
              <Info label="Typ práce" value={workTypeLabel ?? '—'} />
              <Info label="Adresa přípojky" value={detail.connection_address} className="sm:col-span-2" />
              <Info label="Délka" value={`${detail.length_meters} m`} />
              <Info label="Počet průrazů" value={String(detail.penetration_count)} />
              {detail.diary_entry_id && (
                <Info label="Stavební deník" value="Automaticky propojeno" className="sm:col-span-2" />
              )}
            </Card>

            <Card>
              <h3 className="mb-2 font-semibold text-theme-primary">Popis provedených prací</h3>
              <p className="whitespace-pre-wrap text-sm text-theme-secondary">{detail.work_description}</p>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">Fotodokumentace</h3>
              {detail.photos.length === 0 ? (
                <p className="text-sm text-theme-muted">Bez fotografií.</p>
              ) : (
                <div className="space-y-4">
                  {(['pred', 'po'] as const).map((phase) => {
                    const photos = detail.photos.filter((p) => p.photo_phase === phase)
                    if (photos.length === 0) return null
                    return (
                      <div key={phase}>
                        <p className="mb-2 text-sm font-medium text-theme-secondary">{PHOTO_PHASE_LABELS[phase]}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {photos.map((photo) => (
                            <div key={photo.id} className="neon-border rounded-xl p-2">
                              <img src={getGpsPhotoUrl(photo.file_path)} alt="" className="max-h-36 w-full rounded-lg object-cover" />
                              <p className="mt-2 text-xs text-theme-primary">
                                {formatDate(photo.captured_date)} · {photo.captured_time.slice(0, 5)}
                              </p>
                              <p className="text-xs text-theme-muted">{photo.address_full}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Button variant="secondary" onClick={onClose}>Zavřít</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}
