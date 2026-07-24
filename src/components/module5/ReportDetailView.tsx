import type { ReportDetail } from '@/types/workers'
import { PRICE_UNIT_LABELS, WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'
import { getFormPhotoUrl } from '@/lib/workers/module5'
import { buildProfessionalReportDocument, escHtml, type CompanyHeader } from '@/lib/print/printDocument'
import { StatusBadge } from '@/components/ui/Badge'

interface ReportDetailViewProps {
  detail: ReportDetail
  printMode?: boolean
}

export function ReportDetailView({ detail, printMode = false }: ReportDetailViewProps) {
  const { report, form, worker, task_items, photos } = detail

  return (
    <div className={printMode ? '' : 'space-y-6'}>
      <div>
        <h2 className="text-xl font-bold text-theme-primary">
          Denní výkaz – {worker.first_name} {worker.last_name}
        </h2>
        <p className="text-sm text-theme-secondary">{worker.position}</p>
        <div className="mt-2">
          <StatusBadge
            label={WORKER_REPORT_STATUS_LABELS[report.status]}
            variant={report.status === 'schvaleny' ? 'success' : report.status === 'k_oprave' ? 'warning' : 'info'}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Meta label="Datum" value={formatDate(report.report_date)} />
        <Meta label="Zakázka" value={report.order_name || '—'} />
        <Meta label="Odpracované hodiny" value={`${report.hours} h`} />
        <Meta label="Celkový výdělek" value={formatCurrency(report.earnings)} />
        <Meta label="Denní záloha" value={formatCurrency(report.advance ?? 0)} />
        <Meta label="Materiál" value={report.material || '—'} />
      </div>

      {form && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Meta label="Začátek práce" value={form.work_start ? formatTimeForInput(form.work_start) : '—'} />
          <Meta label="Konec práce" value={form.work_end ? formatTimeForInput(form.work_end) : '—'} />
          <Meta label="Přestávka" value={form.break_minutes ? `${form.break_minutes} min` : '—'} />
        </div>
      )}

      {report.note && <Meta label="Poznámka" value={report.note} className="sm:col-span-2" />}

      <div>
        <h3 className="mb-3 font-semibold text-theme-primary">Vykázané práce</h3>
        {task_items.length === 0 ? (
          <p className="text-sm text-theme-muted">Žádné výkony.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl table-glass neon-border">
            <table className="w-full min-w-[360px] text-left text-sm sm:min-w-[640px]">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-theme-secondary">Název práce</th>
                  <th className="px-4 py-3 font-semibold text-theme-secondary">Množství</th>
                  <th className="px-4 py-3 font-semibold text-theme-secondary">Jednotka</th>
                  <th className="px-4 py-3 font-semibold text-theme-secondary">Cena</th>
                  <th className="px-4 py-3 font-semibold text-theme-secondary">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {task_items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-theme-primary">{item.name}</td>
                    <td className="px-4 py-3 text-theme-primary">{item.quantity}</td>
                    <td className="px-4 py-3 text-theme-primary">{PRICE_UNIT_LABELS[item.unit_type]}</td>
                    <td className="px-4 py-3 text-theme-primary">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 font-medium text-accent">{formatCurrency(item.line_earnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form?.gps_lat != null && form.gps_lng != null && (
        <Meta
          label="GPS poloha"
          value={`${form.gps_lat.toFixed(5)}, ${form.gps_lng.toFixed(5)}${form.gps_accuracy ? ` (±${Math.round(form.gps_accuracy)} m)` : ''}`}
        />
      )}

      {photos.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-theme-primary">Fotografie</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={getFormPhotoUrl(photo.file_path)}
                alt={photo.file_name}
                className="max-h-48 w-full rounded-xl object-cover neon-border"
              />
            ))}
          </div>
        </div>
      )}

      {form?.signature_data && (
        <div>
          <h3 className="mb-3 font-semibold text-theme-primary">Podpis zaměstnance</h3>
          <img
            src={form.signature_data}
            alt="Podpis zaměstnance"
            className="max-h-32 rounded-xl border border-[var(--border-glass)] bg-white p-2"
          />
        </div>
      )}

      <p className="text-xs text-theme-muted">
        Docházka slouží pouze jako evidence odpracovaného času. Výdělek se počítá výhradně z výkonů a osobního ceníku.
      </p>
    </div>
  )
}

function Meta({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}

function metaRow(label: string, value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '' || value === '—') return ''
  return `<div><span class="label">${escHtml(label)}:</span> ${escHtml(value)}</div>`
}

export function buildReportPrintHtml(detail: ReportDetail): string {
  const { report, form, worker, task_items, photos } = detail

  const rows = task_items
    .map(
      (item) =>
        `<tr><td>${escHtml(item.name)}</td><td class="num">${escHtml(item.quantity)}</td><td>${escHtml(PRICE_UNIT_LABELS[item.unit_type])}</td><td class="num">${escHtml(formatCurrency(item.price))}</td><td class="num">${escHtml(formatCurrency(item.line_earnings))}</td></tr>`
    )
    .join('')

  const photoHtml = photos
    .map(
      (p) =>
        `<div class="doc-photo-block"><img src="${escHtml(getFormPhotoUrl(p.file_path))}" alt="${escHtml(p.file_name)}" /></div>`
    )
    .join('')

  const attendanceHtml = form
    ? `
      <h2>Docházka</h2>
      <div class="doc-meta-grid">
        ${metaRow('Začátek práce', form.work_start ? formatTimeForInput(form.work_start) : null)}
        ${metaRow('Konec práce', form.work_end ? formatTimeForInput(form.work_end) : null)}
        ${metaRow('Přestávka', form.break_minutes ? `${form.break_minutes} min` : null)}
      </div>
    `
    : ''

  const gpsHtml =
    form?.gps_lat != null && form.gps_lng != null
      ? metaRow(
          'GPS poloha',
          `${form.gps_lat.toFixed(5)}, ${form.gps_lng.toFixed(5)}${form.gps_accuracy ? ` (±${Math.round(form.gps_accuracy)} m)` : ''}`
        )
      : ''

  return `
    <section class="doc-section">
      <div class="doc-meta-grid">
        ${metaRow('Pozice', worker.position)}
        ${metaRow('Datum', formatDate(report.report_date))}
        ${metaRow('Zakázka', report.order_name)}
        ${metaRow('Odpracované hodiny', `${report.hours} h`)}
        ${metaRow('Celkový výdělek', formatCurrency(report.earnings))}
        ${metaRow('Denní záloha', formatCurrency(report.advance ?? 0))}
        ${metaRow('Stav', WORKER_REPORT_STATUS_LABELS[report.status])}
        ${metaRow('Materiál', report.material)}
        ${metaRow('Poznámka', report.note)}
        ${gpsHtml}
      </div>
    </section>

    ${attendanceHtml ? `<section class="doc-section">${attendanceHtml}</section>` : ''}

    <section class="doc-section">
      <h2>Vykázané práce</h2>
      <table class="doc-table">
        <thead><tr><th>Název</th><th>Množství</th><th>Jednotka</th><th>Cena</th><th>Celkem</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Žádné výkony</td></tr>'}</tbody>
      </table>
    </section>

    ${form?.signature_data ? `<section class="doc-section"><h2>Podpis zaměstnance</h2><div class="doc-photo-block"><img src="${escHtml(form.signature_data)}" style="max-height:120px" alt="Podpis" /></div></section>` : ''}
    ${photoHtml ? `<section class="doc-section"><h2>Fotografie</h2>${photoHtml}</section>` : ''}

    <section class="doc-section">
      <p class="doc-text" style="font-size:9pt;color:#666">Docházka slouží pouze jako evidence odpracovaného času. Výdělek se počítá výhradně z výkonů a osobního ceníku.</p>
    </section>
  `
}

export function buildReportPrintDocument(detail: ReportDetail, company?: CompanyHeader | null): string {
  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  return buildProfessionalReportDocument(
    {
      title: `Denní výkaz – ${workerName}`,
      documentNumber: `VYK-${detail.report.id.slice(0, 8).toUpperCase()}`,
    },
    buildReportPrintHtml(detail),
    company
  )
}
