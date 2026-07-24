import { useEffect, useState } from 'react'
import { X, Eye, Printer, FileDown, Mail, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { fetchPayrollSlipDetail } from '@/lib/payroll/api'
import {
  buildPayrollSlipTitle,
  downloadPayrollSlipReport,
  previewPayrollSlipPdf,
  printPayrollSlipReport,
} from '@/lib/payroll/payrollReport'
import {
  buildPayrollShareText,
  getEmailShareUrl,
  getMessengerShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/payroll/share'
import type { PayrollPeriod } from '@/types/payroll'
import { formatCurrency, formatDate } from '@/constants/workers'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

interface PayrollSlipDetailModalProps {
  workerId: string | null
  period: PayrollPeriod
  onClose: () => void
}

const MONTH_NAMES = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
]

function formatPerformance(hours: number, meters: number, pieces: number, activity: string): string {
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hod`)
  if (meters > 0) parts.push(`${meters} bm`)
  if (pieces > 0) parts.push(`${pieces} ks`)
  if (activity.trim()) parts.push(activity.trim())
  return parts.join(' · ') || '—'
}

export function PayrollSlipDetailModal({ workerId, period, onClose }: PayrollSlipDetailModalProps) {
  const { settings: companySettings } = useCompanySettings()
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchPayrollSlipDetail>>>(null)

  useEffect(() => {
    if (!workerId) {
      setDetail(null)
      return
    }
    setLoading(true)
    fetchPayrollSlipDetail(workerId, period)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [workerId, period])

  if (!workerId) return null

  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  function share(channel: 'whatsapp' | 'messenger' | 'email') {
    if (!detail) return
    printPayrollSlipReport(detail, company)
    const text = buildPayrollShareText(detail, company.company_name)
    const subject = buildPayrollSlipTitle(detail)

    if (channel === 'whatsapp') {
      window.open(getWhatsAppShareUrl(text), '_blank')
    } else if (channel === 'messenger') {
      window.open(getMessengerShareUrl(text), '_blank')
    } else {
      window.location.href = getEmailShareUrl(text, subject)
    }
  }

  const periodLabel = `${MONTH_NAMES[period.month - 1] ?? period.month} ${period.year}`

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-xl glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-theme-primary sm:text-xl">Výplatní páska</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : !detail ? (
          <div className="py-16 text-center">
            <p className="text-theme-primary">Žádné schválené výkazy v tomto období.</p>
            <p className="mt-2 text-sm text-theme-secondary">
              Nejdříve schvalte denní formuláře ve Výkazech nebo Denních formulářích.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="grid gap-3 sm:grid-cols-2">
              <Info label="Společnost" value={company.company_name} />
              <Info label="Období" value={periodLabel} />
              <Info label="Zaměstnanec" value={`${detail.summary.worker_first_name} ${detail.summary.worker_last_name}`} />
              <Info label="Schválených výkazů" value={String(detail.summary.report_count)} />
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">Odpracované výkony</h3>
              <div className="overflow-x-auto">
                <DataTable
                  columns={[
                    { key: 'date', label: 'Datum' },
                    { key: 'order', label: 'Zakázka' },
                    { key: 'perf', label: 'Výkon' },
                    { key: 'earnings', label: 'Výdělek', className: 'text-right' },
                    { key: 'advance', label: 'Záloha', className: 'text-right' },
                  ]}
                  isEmpty={detail.reports.length === 0}
                  emptyMessage="Bez schválených výkazů v tomto období."
                >
                  {detail.reports.map((report) => (
                    <DataTableRow key={report.id}>
                      <DataTableCell>{formatDate(report.report_date)}</DataTableCell>
                      <DataTableCell>{report.order_name || '—'}</DataTableCell>
                      <DataTableCell>
                        {formatPerformance(report.hours, report.meters, report.pieces, report.activity)}
                      </DataTableCell>
                      <DataTableCell className="text-right">{formatCurrency(report.earnings)}</DataTableCell>
                      <DataTableCell className="text-right">{formatCurrency(report.advance ?? 0)}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTable>
              </div>
            </Card>

            <Card className="grid gap-2 sm:max-w-md sm:ml-auto">
              <SummaryRow label="Celkový výdělek" value={formatCurrency(detail.summary.total_earnings)} />
              <SummaryRow label="Vyplacené zálohy" value={formatCurrency(detail.summary.total_advances)} />
              <SummaryRow label="Konečná částka k výplatě" value={formatCurrency(detail.summary.net_amount)} highlight />
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">PDF a sdílení</h3>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => previewPayrollSlipPdf(detail, company)}>
                  <Eye className="h-4 w-4" />
                  Náhled
                </Button>
                <Button variant="secondary" size="sm" onClick={() => printPayrollSlipReport(detail, company)}>
                  <Printer className="h-4 w-4" />
                  Tisk / PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pdfBusy}
                  onClick={() => {
                    setPdfBusy(true)
                    void downloadPayrollSlipReport(detail, company).finally(() => setPdfBusy(false))
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  Stáhnout
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

function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${highlight ? 'rounded-xl bg-[var(--accent-primary)]/10 px-3 py-2' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-theme-primary' : 'text-theme-secondary'}`}>{label}</span>
      <span className={`font-semibold ${highlight ? 'text-[var(--accent-primary)]' : 'text-theme-primary'}`}>{value}</span>
    </div>
  )
}
