import { downloadCsv, printHtml } from '@/lib/export'
import { buildCompanyHeaderHtml, escHtml } from '@/lib/print/printDocument'
import { formatCurrency, formatDate } from '@/constants/workers'
import type { CompanySettings } from '@/types'
import type { OrderProfitRow } from '@/types/profit'

const EXPORT_COLUMNS: { key: keyof OrderProfitRow | 'result'; label: string }[] = [
  { key: 'order_name', label: 'Zakázka' },
  { key: 'period_from', label: 'Období od' },
  { key: 'period_to', label: 'Období do' },
  { key: 'invoiced_amount', label: 'Vyfakturovaná částka' },
  { key: 'labor_costs', label: 'Mzdové náklady' },
  { key: 'employee_advances', label: 'Zálohy zaměstnancům' },
  { key: 'material_costs', label: 'Materiál' },
  { key: 'tools_costs', label: 'Nářadí' },
  { key: 'rental_costs', label: 'Půjčovna' },
  { key: 'accommodation_costs', label: 'Ubytování' },
  { key: 'fuel_costs', label: 'PHM' },
  { key: 'tickets_costs', label: 'Jízdenky' },
  { key: 'other_costs', label: 'Ostatní náklady' },
  { key: 'total_costs', label: 'Celkové náklady' },
  { key: 'net_profit', label: 'Čistý zisk / ztráta' },
  { key: 'profit_margin', label: 'Zisková marže (%)' },
  { key: 'result', label: 'Výsledek' },
]

function formatMargin(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(2)} %`
}

function formatMoney(value: number): string {
  return formatCurrency(value).replace(/\u00a0/g, ' ')
}

function resultLabel(netProfit: number): string {
  return netProfit >= 0 ? 'Zisk' : 'Ztráta'
}

function rowToExportCells(row: OrderProfitRow): string[] {
  return EXPORT_COLUMNS.map(({ key }) => {
    if (key === 'order_name') return row.order_name
    if (key === 'period_from') return formatDate(row.period_from)
    if (key === 'period_to') return formatDate(row.period_to)
    if (key === 'profit_margin') return formatMargin(row.profit_margin)
    if (key === 'result') return resultLabel(row.net_profit)
    if (key === 'invoiced_amount') return formatMoney(row.invoiced_amount)
    if (key === 'labor_costs') return formatMoney(row.labor_costs)
    if (key === 'employee_advances') return formatMoney(row.employee_advances)
    if (key === 'material_costs') return formatMoney(row.material_costs)
    if (key === 'tools_costs') return formatMoney(row.tools_costs)
    if (key === 'rental_costs') return formatMoney(row.rental_costs)
    if (key === 'accommodation_costs') return formatMoney(row.accommodation_costs)
    if (key === 'fuel_costs') return formatMoney(row.fuel_costs)
    if (key === 'tickets_costs') return formatMoney(row.tickets_costs)
    if (key === 'other_costs') return formatMoney(row.other_costs)
    if (key === 'total_costs') return formatMoney(row.total_costs)
    return formatMoney(row.net_profit)
  })
}

export function exportProfitOverviewExcel(rows: OrderProfitRow[], filename = 'prehled-hospodarstvi-a-zisku.csv'): void {
  downloadCsv(
    filename,
    EXPORT_COLUMNS.map((col) => col.label),
    rows.map(rowToExportCells)
  )
}

export function exportProfitOverviewPdf(
  rows: OrderProfitRow[],
  company: CompanySettings | null,
  periodLabel: string
): void {
  const header = buildCompanyHeaderHtml(company, 'Přehled hospodaření a zisku')
  const tableRows = rows
    .map((row) => {
      const profitClass = row.net_profit >= 0 ? 'profit' : 'loss'
      return `<tr>
        <td>${escHtml(row.order_name)}</td>
        <td>${escHtml(formatDate(row.period_from))}</td>
        <td>${escHtml(formatDate(row.period_to))}</td>
        <td class="num">${escHtml(formatMoney(row.invoiced_amount))}</td>
        <td class="num">${escHtml(formatMoney(row.labor_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.employee_advances))}</td>
        <td class="num">${escHtml(formatMoney(row.material_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.tools_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.rental_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.accommodation_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.fuel_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.tickets_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.other_costs))}</td>
        <td class="num">${escHtml(formatMoney(row.total_costs))}</td>
        <td class="num ${profitClass}">${escHtml(formatMoney(row.net_profit))}</td>
        <td class="num ${profitClass}">${escHtml(formatMargin(row.profit_margin))}</td>
        <td class="${profitClass}">${escHtml(resultLabel(row.net_profit))}</td>
      </tr>`
    })
    .join('')

  const body = `
    ${header}
    <p class="subtitle">Období: ${escHtml(periodLabel)} · Vygenerováno ${escHtml(new Date().toLocaleString('cs-CZ'))}</p>
    <table>
      <thead>
        <tr>
          ${EXPORT_COLUMNS.map((col) => `<th>${escHtml(col.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p class="footer">VH Bulldig ERP – Přehled hospodaření a zisku</p>
  `

  printHtml('Přehled hospodaření a zisku', body)
}
