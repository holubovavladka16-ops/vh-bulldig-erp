import { useEffect, useState } from 'react'
import { X, Printer, FileDown, Mail, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { fetchDiaryDetail } from '@/lib/diary/api'
import { downloadDiaryReportHtml, printDiaryReport, buildDiaryReportTitle } from '@/lib/diary/diaryReport'
import {
  buildDiaryShareText,
  getEmailShareUrl,
  getMessengerShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/diary/share'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import type { ConstructionDiaryDetail } from '@/types/diary'
import { formatDate, formatTime } from '@/constants/workers'

interface DiaryDetailModalProps {
  entryId: string | null
  onClose: () => void
}

export function DiaryDetailModal({ entryId, onClose }: DiaryDetailModalProps) {
  const { settings: company } = useCompanySettings()
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

  function exportPdf() {
    if (!detail) return
    printDiaryReport(detail, company)
  }

  function savePdf() {
    if (!detail) return
    downloadDiaryReportHtml(detail, company)
  }

  function share(channel: 'whatsapp' | 'messenger' | 'email') {
    if (!detail) return
    printDiaryReport(detail, company)
    const text = buildDiaryShareText(detail)
    const subject = buildDiaryReportTitle(detail)

    if (channel === 'whatsapp') {
      window.open(getWhatsAppShareUrl(text), '_blank')
    } else if (channel === 'messenger') {
      window.open(getMessengerShareUrl(text), '_blank')
    } else {
      window.location.href = getEmailShareUrl(text, subject)
    }
  }

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

        {loading || !detail ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="grid gap-3 sm:grid-cols-2">
              <Info label="Datum" value={formatDate(detail.entry_date)} />
              <Info label="Zakázka" value={detail.order_name ?? '—'} />
              <Info label="Počasí" value={detail.weather} />
              <Info label="Počet dělníků" value={String(detail.worker_count)} />
              <Info label="Zaměstnanci" value={detail.worker_names} className="sm:col-span-2" />
              <Info label="Technika" value={detail.equipment} className="sm:col-span-2" />
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.photos.map((photo) => (
                    <div key={photo.id} className="neon-border rounded-xl p-2">
                      <img src={getGpsPhotoUrl(photo.file_path)} alt="" className="max-h-40 w-full rounded-lg object-cover" />
                      <p className="mt-2 text-xs text-theme-primary">
                        {formatDate(photo.captured_date)} · {formatTime(photo.captured_time)}
                      </p>
                      <p className="text-xs text-theme-muted">{photo.address_full}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">PDF a sdílení</h3>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={exportPdf}>
                  <Printer className="h-4 w-4" />
                  Export PDF (tisk)
                </Button>
                <Button variant="secondary" size="sm" onClick={savePdf}>
                  <FileDown className="h-4 w-4" />
                  Uložit PDF report
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => share('whatsapp')}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="secondary" size="sm" onClick={() => share('messenger')}>
                  <Send className="h-4 w-4" />
                  Messenger
                </Button>
                <Button variant="secondary" size="sm" onClick={() => share('email')}>
                  <Mail className="h-4 w-4" />
                  E-mail
                </Button>
              </div>
            </Card>
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
