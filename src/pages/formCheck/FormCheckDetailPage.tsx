import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, XCircle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { FormCheckCompareTable } from '@/components/formCheck/FormCheckCompareTable'
import { FormCheckOutcomeBadge } from '@/components/formCheck/FormCheckOutcomeBadge'
import {
  FORM_CHECK_OUTCOME_CARD_CLASS,
  FORM_CHECK_OUTCOME_DESCRIPTIONS,
  FORM_CHECK_OUTCOME_TEXT_CLASS,
} from '@/constants/formCheck'
import { buildFormCheckPdfBlob, getFormCheckPdfFilename } from '@/lib/formCheck/pdf'
import { fetchFormCheckRecord, getFormCheckPhotoUrl } from '@/lib/formCheck/records'
import type { FormCheckRecordDetail } from '@/types/formCheck'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConfidence(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)} %`
}

function formatNumber(value: number | null, suffix = ''): string {
  if (value == null) return '—'
  return `${value}${suffix}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('cs-CZ')
}

export function FormCheckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [record, setRecord] = useState<FormCheckRecordDetail | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [showAllCompare, setShowAllCompare] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')
    fetchFormCheckRecord(id)
      .then(async (data) => {
        if (!data) {
          setError('Kontrola nebyla nalezena.')
          setRecord(null)
          return
        }
        setRecord(data)
        const url = await getFormCheckPhotoUrl(data.photoPath)
        setPhotoUrl(url)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Načtení detailu kontroly se nezdařilo')
        setRecord(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleExportPdf = useCallback(async () => {
    if (!record) return
    setExporting(true)
    try {
      const blob = await buildFormCheckPdfBlob(record, photoUrl)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getFormCheckPdfFilename(record)
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export PDF se nezdařil')
    } finally {
      setExporting(false)
    }
  }, [record, photoUrl])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  if (!record) {
    return (
      <AppLayout>
        <PageHeader title="Detail kontroly" />
        <Card>
          <p className="text-theme-secondary">{error || 'Kontrola nebyla nalezena.'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/kontrola-formulare/historie')}>
            <ArrowLeft className="h-4 w-4" />
            Zpět na historii
          </Button>
        </Card>
      </AppLayout>
    )
  }

  const isMatch = record.outcome === 'match'
  const isManualReview = record.outcome === 'manual_review'

  const ocrColumns = [
    { key: 'date', label: 'Datum' },
    { key: 'order', label: 'Zakázka' },
    { key: 'hours', label: 'Hodiny' },
    { key: 'bm', label: 'Výkop (bm)' },
    { key: 'penetration', label: 'Protlaky (ks)' },
    { key: 'advance', label: 'Záloha (Kč)' },
    { key: 'note', label: 'Poznámka' },
    { key: 'confidence', label: 'Spolehlivost' },
  ]

  return (
    <AppLayout>
      <PageHeader
        title={`Kontrola formuláře ${record.formNumber}`}
        description={`${record.workerName} · ${record.periodLabel} · ${formatDateTime(record.checkedAt)}`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => navigate('/kontrola-formulare/historie')}>
              <ArrowLeft className="h-4 w-4" />
              Historie
            </Button>
            <Button onClick={handleExportPdf} loading={exporting}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="space-y-4">
        <Card className={FORM_CHECK_OUTCOME_CARD_CLASS[record.outcome]}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {isMatch ? (
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-400" />
              ) : isManualReview ? (
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-orange-400" />
              ) : (
                <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className={`text-xl font-bold ${FORM_CHECK_OUTCOME_TEXT_CLASS[record.outcome]}`}>
                    {FORM_CHECK_OUTCOME_DESCRIPTIONS[record.outcome]}
                  </h3>
                  <FormCheckOutcomeBadge outcome={record.outcome} />
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    Uživatel: <strong>{record.checkedByName ?? '—'}</strong>
                  </div>
                  <div>
                    Počet rozdílů: <strong>{record.differenceCount}</strong>
                  </div>
                  <div>
                    OCR confidence: <strong>{formatConfidence(record.ocrConfidence)}</strong>
                  </div>
                  <div>
                    Porovnaných dnů: <strong>{record.comparisonResult.comparedDays}</strong>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        {photoUrl && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-theme-primary">Fotografie formuláře</h3>
            <img
              src={photoUrl}
              alt={`Fotografie formuláře ${record.formNumber}`}
              className="max-h-[480px] w-full rounded-xl border border-[var(--border-glass)] object-contain"
            />
          </Card>
        )}

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-theme-primary">Výsledek OCR</h3>
          <dl className="mb-6 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-theme-secondary">Zaměstnanec</dt>
              <dd className="mt-1 font-medium text-theme-primary">
                {record.ocrResult.workerName ?? record.workerName}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-theme-secondary">Měsíc</dt>
              <dd className="mt-1 font-medium text-theme-primary">
                {record.ocrResult.monthLabel ?? record.periodLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-theme-secondary">Celková spolehlivost</dt>
              <dd className="mt-1 font-medium text-theme-primary">
                {formatConfidence(record.ocrResult.overallConfidence)}
              </dd>
            </div>
          </dl>

          <DataTable
            columns={ocrColumns}
            isEmpty={record.ocrResult.lines.length === 0}
            emptyMessage="OCR nerozpoznalo žádné řádky"
          >
            {record.ocrResult.lines.map((line, index) => (
              <DataTableRow key={`${line.formDate}-${index}`}>
                <DataTableCell>{formatDate(line.formDate)}</DataTableCell>
                <DataTableCell>
                  {[line.orderCode, line.orderName].filter(Boolean).join(' – ') || '—'}
                </DataTableCell>
                <DataTableCell>{formatNumber(line.performanceHours, ' h')}</DataTableCell>
                <DataTableCell>{formatNumber(line.manualDigBm, ' bm')}</DataTableCell>
                <DataTableCell>{formatNumber(line.penetrationKs, ' ks')}</DataTableCell>
                <DataTableCell>{formatNumber(line.dailyAdvance, ' Kč')}</DataTableCell>
                <DataTableCell>{line.note || '—'}</DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    label={formatConfidence(line.confidence)}
                    variant={
                      line.confidence == null
                        ? 'neutral'
                        : line.confidence >= 0.8
                          ? 'success'
                          : line.confidence >= 0.6
                            ? 'warning'
                            : 'danger'
                    }
                  />
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-theme-primary">Výsledek porovnání</h3>
            <div className="flex gap-2">
              <Button
                variant={showAllCompare ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowAllCompare(true)}
              >
                Všechny položky
              </Button>
              <Button
                variant={!showAllCompare ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowAllCompare(false)}
              >
                Pouze rozdíly
              </Button>
            </div>
          </div>

          <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              Hodiny formulář: <strong>{record.comparisonResult.formTotalHours ?? '—'} h</strong>
            </div>
            <div>
              Hodiny ERP: <strong>{record.comparisonResult.erpTotalHours ?? '—'} h</strong>
            </div>
          </dl>

          <FormCheckCompareTable comparison={record.comparisonResult} showMatches={showAllCompare} />
        </Card>

        {record.comparisonResult.summaryRows.length > 0 && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-theme-primary">Souhrny</h3>
            <DataTable
              columns={[
                { key: 'field', label: 'Pole' },
                { key: 'erp', label: 'Docházka' },
                { key: 'form', label: 'Formulář' },
                { key: 'status', label: 'Stav' },
              ]}
              isEmpty={false}
            >
              {record.comparisonResult.summaryRows.map((row) => (
                <DataTableRow key={row.field}>
                  <DataTableCell>{row.fieldLabel}</DataTableCell>
                  <DataTableCell>{row.erpTotal ?? '—'}</DataTableCell>
                  <DataTableCell>{row.formTotal ?? '—'}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={
                        row.status === 'match'
                          ? 'Shoda'
                          : row.status === 'mismatch'
                            ? 'Neshoda'
                            : row.status === 'low_confidence'
                              ? 'Ruční kontrola'
                              : row.status
                      }
                      variant={
                        row.status === 'match'
                          ? 'success'
                          : row.status === 'mismatch'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          </Card>
        )}

        <p className="text-sm text-theme-muted">
          Poznámka: Tato kontrola pouze ukládá výsledek porovnání. Docházka v ERP nebyla změněna.
        </p>
      </div>
    </AppLayout>
  )
}
