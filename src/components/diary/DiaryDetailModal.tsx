import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { fetchDiaryDetail } from '@/lib/diary/api'

import { DiaryExportPanel } from '@/components/diary/DiaryExportPanel'

import { DiaryPhotoCard } from '@/components/diary/DiaryPhotoCard'

import { DiaryPhotosMap } from '@/components/diary/DiaryPhotosMap'

import type { ConstructionDiaryDetail } from '@/types/diary'

import { formatDate } from '@/constants/workers'

import { formatDiaryWeather } from '@/constants/diary'



interface DiaryDetailModalProps {

  entryId: string | null

  onClose: () => void

}



export function DiaryDetailModal({ entryId, onClose }: DiaryDetailModalProps) {
  const [detail, setDetail] = useState<ConstructionDiaryDetail | null>(null)

  const [loading, setLoading] = useState(false)



  useEffect(() => {

    if (!entryId) return

    setLoading(true)

    fetchDiaryDetail(entryId)

      .then(setDetail)

      .finally(() => setLoading(false))

  }, [entryId])



  if (!entryId) return null



  return (

    <div className="modal-overlay">

      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="modal-panel modal-panel-xl glass-panel neon-border scrollbar-premium">

        <div className="mb-4 flex items-center justify-between">

          <h2 className="text-xl font-bold text-theme-primary">Zápis stavebního deníku</h2>

          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">

            <X className="h-5 w-5" />

          </button>

        </div>



        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : !detail ? (
          <p className="py-16 text-center text-theme-secondary">Zápis stavebního deníku nenalezen.</p>
        ) : (

          <div className="space-y-6">

            <Card className="grid gap-3 sm:grid-cols-2">

              <Info label="Číslo zápisu" value={detail.entry_number != null ? `č. ${detail.entry_number}` : '—'} />

              <Info label="Datum" value={formatDate(detail.entry_date)} />

              <Info label="Zakázka" value={[detail.order_number, detail.order_name].filter(Boolean).join(' – ') || '—'} />

              <Info label="Místo stavby" value={detail.site_location || '—'} />

              <Info

                label="Počasí"

                value={detail.weather || formatDiaryWeather(detail.weather_type, detail.temperature_celsius) || '—'}

              />

              <Info

                label="Teplota"

                value={

                  detail.temperature_celsius != null ? `${detail.temperature_celsius} °C` : '—'

                }

              />

              <Info label="Počet dělníků" value={String(detail.worker_count)} />

              <Info label="Přítomní dělníci" value={detail.worker_names} className="sm:col-span-2" />

              <Info label="Technika" value={detail.equipment || '—'} className="sm:col-span-2" />

              <Info label="Materiál" value={detail.material || '—'} className="sm:col-span-2" />

            </Card>



            {detail.performances_summary && (

              <Card>

                <h3 className="mb-2 font-semibold text-theme-primary">Výkony z docházky</h3>

                <p className="whitespace-pre-wrap text-sm text-theme-secondary">{detail.performances_summary}</p>

              </Card>

            )}



            <Card>

              <div className="mb-2 flex flex-wrap items-center gap-2">

                <h3 className="font-semibold text-theme-primary">Popis provedených prací</h3>

                {detail.ai_assisted && (

                  <span className="rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-primary)]">

                    Upraveno AI (Gemini)

                  </span>

                )}

              </div>

              <p className="whitespace-pre-wrap text-sm text-theme-secondary">{detail.work_description}</p>

              {detail.ai_assisted && detail.rough_work_description && (

                <div className="mt-4 rounded-xl border border-[var(--border-glass)] bg-white/5 px-3 py-2">

                  <p className="text-xs font-medium text-theme-muted">Původní hrubý popis</p>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-theme-secondary">{detail.rough_work_description}</p>

                </div>

              )}

            </Card>



            {(detail.note || detail.extraordinary_events) && (

              <Card className="grid gap-3 sm:grid-cols-2">

                {detail.note && <Info label="Poznámka" value={detail.note} className="sm:col-span-2" />}

                {detail.extraordinary_events && (

                  <Info label="Mimořádné události" value={detail.extraordinary_events} className="sm:col-span-2" />

                )}

              </Card>

            )}



            <Card className="space-y-4">

              <h3 className="font-semibold text-theme-primary">Fotodokumentace</h3>

              {detail.photos.length === 0 ? (

                <p className="text-sm text-theme-muted">Bez fotografií z modulu Fotodokumentace.</p>

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



            <DiaryExportPanel singleEntryId={detail.id} orderOptions={[]} />

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

