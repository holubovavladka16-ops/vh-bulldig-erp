import { useEffect, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DiaryPhotoCard } from '@/components/diary/DiaryPhotoCard'
import { DiaryPhotosMap } from '@/components/diary/DiaryPhotosMap'
import { DiaryStatusBadge } from '@/components/zakazkyMapa/DiaryStatusBadge'
import { fetchDiaryDetail } from '@/lib/zakazkyMapa/diaryApi'
import { formatDiaryWeather } from '@/constants/diary'
import { formatDate } from '@/constants/workers'
import type { ConstructionDiaryDetail } from '@/types/diary'

interface ProjectDiaryEntryDetailProps {
  entryId: string | null
  onClose: () => void
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Info({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}

export function ProjectDiaryEntryDetail({ entryId, onClose }: ProjectDiaryEntryDetailProps) {
  const [detail, setDetail] = useState<ConstructionDiaryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!entryId) {
      setDetail(null)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    fetchDiaryDetail(entryId)
      .then((data) => {
        if (!data) throw new Error('Zápis nenalezen')
        setDetail(data)
      })
      .catch((err) => {
        setDetail(null)
        setError(err instanceof Error ? err.message : 'Načtení detailu se nezdařilo')
      })
      .finally(() => setLoading(false))
  }, [entryId])

  if (!entryId) return null

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Zpět na seznam
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 hover:bg-white/5 xl:hidden"
          aria-label="Zavřít detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-sm text-red-300">{error}</p>
      ) : detail ? (
        <div className="scrollbar-premium max-h-[min(50vh,480px)] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-theme-primary">
              Zápis {formatDate(detail.entry_date)}
            </h4>
            <DiaryStatusBadge status={detail.entry_status} />
          </div>

          <Card className="grid gap-3 sm:grid-cols-2">
            <Info label="Datum" value={formatDate(detail.entry_date)} />
            <Info
              label="Počasí"
              value={detail.weather || formatDiaryWeather(detail.weather_type, detail.temperature_celsius) || '—'}
            />
            <Info label="Technika" value={detail.equipment || '—'} className="sm:col-span-2" />
            <Info label="Počet pracovníků" value={String(detail.worker_count)} />
            <Info label="Jména pracovníků" value={detail.worker_names || '—'} className="sm:col-span-2" />
            <Info label="Denní činnost / výkony" value={detail.performances_summary || '—'} className="sm:col-span-2" />
            <Info label="Autor" value={detail.creator_name ?? '—'} />
            <Info label="Vytvořeno" value={formatDateTime(detail.created_at)} />
            <Info label="Poslední změna" value={formatDateTime(detail.updated_at)} className="sm:col-span-2" />
          </Card>

          <Card>
            <h5 className="mb-2 font-semibold text-theme-primary">Popis prací</h5>
            <p className="whitespace-pre-wrap text-sm text-theme-secondary">{detail.work_description}</p>
          </Card>

          {(detail.note || detail.extraordinary_events) && (
            <Card className="grid gap-3">
              {detail.note ? <Info label="Poznámka" value={detail.note} /> : null}
              {detail.extraordinary_events ? (
                <Info label="Mimořádné události" value={detail.extraordinary_events} />
              ) : null}
            </Card>
          )}

          <Card className="space-y-3">
            <h5 className="font-semibold text-theme-primary">
              Fotografie ({detail.photos.length})
            </h5>
            {detail.photos.length === 0 ? (
              <p className="text-sm text-theme-muted">Bez fotografií u tohoto zápisu.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {detail.photos.map((photo) => (
                    <DiaryPhotoCard key={photo.id} photo={photo} />
                  ))}
                </div>
                <DiaryPhotosMap photos={detail.photos} />
              </>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  )
}
