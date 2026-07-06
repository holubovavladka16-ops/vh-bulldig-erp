import { downloadCsv, printHtml } from '@/lib/export'
import { buildCompanyHeaderHtml, escHtml } from '@/lib/print/printDocument'
import { ATTENDANCE_STATUS_LABELS, attendanceSourceLabel } from '@/constants/attendance'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'
import type { AttendanceListRecord } from '@/lib/workers/module5'
import type { CompanySettings } from '@/types'

export function exportAttendanceExcel(records: AttendanceListRecord[], filename = 'dochazka.csv'): void {
  downloadCsv(
    filename,
    ['Datum', 'Zaměstnanec', 'Zakázka', 'Stav', 'Začátek', 'Konec', 'Přestávka', 'Hodiny', 'Poznámka', 'Zdroj'],
    records.map((r) => [
      formatDate(r.attendance_date),
      `${r.worker_last_name} ${r.worker_first_name}`,
      r.order_name || '',
      ATTENDANCE_STATUS_LABELS[r.attendance_status ?? 'pritomen'],
      r.work_start ? formatTimeForInput(r.work_start) : '',
      r.work_end ? formatTimeForInput(r.work_end) : '',
      r.break_minutes ? `${r.break_minutes} min` : '',
      String(r.hours),
      r.note || '',
      attendanceSourceLabel(r.form_id),
    ])
  )
}

export function exportAttendancePdf(records: AttendanceListRecord[], company: CompanySettings | null): void {
  const header = buildCompanyHeaderHtml(company, 'Docházka zaměstnanců')
  const rows = records
    .map(
      (r) => `<tr>
        <td>${escHtml(formatDate(r.attendance_date))}</td>
        <td>${escHtml(`${r.worker_last_name} ${r.worker_first_name}`)}</td>
        <td>${escHtml(r.order_name || '—')}</td>
        <td>${escHtml(ATTENDANCE_STATUS_LABELS[r.attendance_status ?? 'pritomen'])}</td>
        <td>${escHtml(r.work_start ? formatTimeForInput(r.work_start) : '—')}</td>
        <td>${escHtml(r.work_end ? formatTimeForInput(r.work_end) : '—')}</td>
        <td>${escHtml(r.break_minutes ? `${r.break_minutes} min` : '—')}</td>
        <td class="num">${escHtml(String(r.hours))} h</td>
        <td>${escHtml(r.note || '—')}</td>
        <td>${escHtml(attendanceSourceLabel(r.form_id))}</td>
      </tr>`
    )
    .join('')

  const body = `
    ${header}
    <p class="subtitle">Export: ${escHtml(formatDate(new Date().toISOString().slice(0, 10)))} · ${records.length} záznamů</p>
    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Zaměstnanec</th>
          <th>Zakázka</th>
          <th>Stav</th>
          <th>Začátek</th>
          <th>Konec</th>
          <th>Přestávka</th>
          <th>Hodiny</th>
          <th>Poznámka</th>
          <th>Zdroj</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `

  printHtml('Docházka zaměstnanců', body)
}
