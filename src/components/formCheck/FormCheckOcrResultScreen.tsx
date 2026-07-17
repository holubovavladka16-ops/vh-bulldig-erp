import { AlertCircle, User, Calendar, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import type { FormCheckContext, FormCheckOcrResult } from '@/types/formCheck'

interface FormCheckOcrResultScreenProps {
  context: FormCheckContext
  result: FormCheckOcrResult
  previewUrl?: string | null
  confirming?: boolean
  onConfirm: () => void
  onRetake: () => void
  onCancel: () => void
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

function confidenceVariant(
  value: number | null
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (value == null) return 'neutral'
  if (value >= 0.8) return 'success'
  if (value >= 0.6) return 'warning'
  return 'danger'
}

export function FormCheckOcrResultScreen({
  context,
  result,
  previewUrl,
  confirming = false,
  onConfirm,
  onRetake,
  onCancel,
}: FormCheckOcrResultScreenProps) {
  const workerDisplay = result.workerName || context.workerName || '—'
  const monthDisplay = result.monthLabel || context.periodLabel

  const columns = [
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
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-theme-primary">Výsledek OCR</h3>
            <p className="mt-1 text-sm text-theme-secondary">
              Rozpoznané údaje z papírového měsíčního výkazu (zatím bez zápisu do docházky).
            </p>
          </div>
          <StatusBadge
            label={`Celková spolehlivost: ${formatConfidence(result.overallConfidence)}`}
            variant={confidenceVariant(result.overallConfidence)}
          />
        </div>

        <dl className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
            <User className="mt-0.5 h-5 w-5 shrink-0 text-theme-secondary" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-theme-secondary">Zaměstnanec</dt>
              <dd className="mt-1 font-medium text-theme-primary">{workerDisplay}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-theme-secondary" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-theme-secondary">Měsíc</dt>
              <dd className="mt-1 font-medium text-theme-primary">{monthDisplay}</dd>
            </div>
          </div>
        </dl>

        {previewUrl && (
          <img
            src={previewUrl}
            alt={`Fotografie formuláře ${context.formNumber}`}
            className="mb-6 max-h-40 w-full rounded-xl border border-[var(--border-glass)] object-contain"
          />
        )}

        <DataTable columns={columns} isEmpty={result.lines.length === 0}>
          {result.lines.map((line, index) => (
            <DataTableRow key={`${line.formDate}-${index}`}>
              <DataTableCell>{formatDate(line.formDate)}</DataTableCell>
              <DataTableCell>
                <div>
                  <div>{line.orderCode ?? '—'}</div>
                  {line.orderName && (
                    <div className="text-xs text-theme-secondary">{line.orderName}</div>
                  )}
                </div>
              </DataTableCell>
              <DataTableCell>{formatNumber(line.performanceHours, ' h')}</DataTableCell>
              <DataTableCell>{formatNumber(line.manualDigBm, ' bm')}</DataTableCell>
              <DataTableCell>{formatNumber(line.penetrationKs, ' ks')}</DataTableCell>
              <DataTableCell>{formatNumber(line.dailyAdvance, ' Kč')}</DataTableCell>
              <DataTableCell className="max-w-[140px] truncate">{line.note || '—'}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  label={formatConfidence(line.confidence)}
                  variant={confidenceVariant(line.confidence)}
                />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>

        {(result.summary.totalHours != null ||
          result.summary.totalBm != null ||
          result.summary.totalPenetrations != null ||
          result.summary.totalAdvance != null) && (
          <div className="mt-4 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-theme-primary">
              <Gauge className="h-4 w-4 text-theme-secondary" />
              Souhrn z formuláře
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <span>Hodiny celkem: {formatNumber(result.summary.totalHours, ' h')}</span>
              <span>Výkop celkem: {formatNumber(result.summary.totalBm, ' bm')}</span>
              <span>Protlaky celkem: {formatNumber(result.summary.totalPenetrations, ' ks')}</span>
              <span>Zálohy celkem: {formatNumber(result.summary.totalAdvance, ' Kč')}</span>
            </div>
          </div>
        )}

        {result.aiModel && (
          <p className="mt-3 text-xs text-theme-muted">Model: {result.aiModel}</p>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={confirming}>
          Zrušit
        </Button>
        <Button variant="secondary" size="lg" onClick={onRetake} disabled={confirming}>
          Vyfotit znovu
        </Button>
        <Button size="lg" onClick={onConfirm} loading={confirming}>
          Potvrdit
        </Button>
      </div>
    </div>
  )
}

interface FormCheckOcrErrorScreenProps {
  message: string
  previewUrl?: string | null
  onRetake: () => void
  onCancel: () => void
}

export function FormCheckOcrErrorScreen({
  message,
  previewUrl,
  onRetake,
  onCancel,
}: FormCheckOcrErrorScreenProps) {
  return (
    <Card className="border-red-500/30 bg-red-500/10">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-300">OCR se nezdařilo</h3>
          <p className="mt-1 text-sm text-red-200/90">{message}</p>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Náhled formuláře"
              className="mt-4 max-h-40 w-full rounded-xl border border-red-500/20 object-contain"
            />
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={onCancel}>
              Zrušit
            </Button>
            <Button onClick={onRetake}>Vyfotit znovu</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
