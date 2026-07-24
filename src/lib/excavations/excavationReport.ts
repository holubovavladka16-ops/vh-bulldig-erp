import { formatDate } from '@/constants/workers'
import {
  formatRouteLength,
  formatSegmentLength,
  getRouteMapUrl,
  getRouteSegments,
} from '@/lib/excavations/geometry'
import { getStaticMapImageUrl } from '@/lib/photos/mapLinks'
import {
  buildProfessionalReportDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { ExcavationRoute } from '@/types/excavations'

function row(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`
}

export function buildExcavationReportHtml(route: ExcavationRoute): string {
  const mapUrl = getRouteMapUrl(route.points)
  const center = route.points[Math.floor(route.points.length / 2)] ?? route.points[0]
  const mapImage = center ? getStaticMapImageUrl(center.lat, center.lng, 720, 240) : ''

  const pointsList = route.points
    .map((p, i) => {
      const label = p.label ? ` – ${escHtml(p.label)}` : ''
      const accuracy =
        p.accuracy != null ? `, přesnost ±${p.accuracy < 10 ? p.accuracy.toFixed(1) : Math.round(p.accuracy)} m` : ''
      return `<li>Bod ${i + 1}${label}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}${accuracy}</li>`
    })
    .join('')

  const segmentsList = getRouteSegments(route.points)
    .map((seg) => `<li>Bod ${seg.fromIndex + 1} → Bod ${seg.toIndex + 1}: ${formatSegmentLength(seg.meters)} m</li>`)
    .join('')

  return `
    <section class="doc-section">
      <h2>Údaje o trase</h2>
      <table class="doc-table doc-table-kv">
        ${row('Zakázka', route.order_name ?? '')}
        ${row('Název trasy', route.name)}
        ${row('Délka výkopu', formatRouteLength(route.total_length_m))}
        ${row('Datum vytvoření', formatDate(route.created_at.slice(0, 10)))}
        ${row('Vytvořil', route.creator_name ?? '—')}
        ${row('Poznámka', route.note ?? '')}
        ${row('Počet GPS bodů', String(route.points.length))}
      </table>
    </section>

    <section class="doc-section">
      <h2>Mapa trasy</h2>
      <div class="doc-photo-wrap">
        ${mapImage ? `<a href="${escHtml(mapUrl)}"><img src="${escHtml(mapImage)}" alt="Mapa trasy" style="width:100%;max-height:240px;object-fit:cover" /></a>` : ''}
      </div>
      <p><a href="${escHtml(mapUrl)}">Otevřít trasu na mapě</a></p>
    </section>

    <section class="doc-section">
      <h2>Úseky trasy</h2>
      <ul>${segmentsList || '<li>—</li>'}</ul>
      <p><strong>Celkem: ${escHtml(formatRouteLength(route.total_length_m))}</strong></p>
    </section>

    <section class="doc-section">
      <h2>GPS body trasy</h2>
      <ul>${pointsList}</ul>
    </section>
  `
}

export function buildExcavationReportDocument(route: ExcavationRoute, company?: CompanyHeader | null): string {
  return buildProfessionalReportDocument(
    {
      title: 'Měření trasy výkopu',
      documentNumber: `VYKOP-${route.id.slice(0, 8).toUpperCase()}`,
    },
    buildExcavationReportHtml(route),
    company
  )
}

export function downloadExcavationReport(route: ExcavationRoute, company?: CompanyHeader | null): void {
  downloadHtmlDocument(
    buildExcavationReportDocument(route, company),
    `vykop_${route.name.replace(/\s+/g, '_')}_${route.id.slice(0, 8)}.html`
  )
}

export function printExcavationReport(route: ExcavationRoute, company?: CompanyHeader | null): void {
  openPrintDocument(buildExcavationReportDocument(route, company))
}
