import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { PortalPriceListCard } from '@/components/portal/PortalPriceListCard'
import { portalGetPriceItems } from '@/lib/workers/api'
import { portalGetAttendance } from '@/lib/workers/module5'
import { ATTENDANCE_STATUS_LABELS } from '@/constants/attendance'
import type { PortalAttendanceRecord, WorkerPriceItem } from '@/types/workers'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

interface PortalAttendanceTabProps {
  token: string
}

export function PortalAttendanceTab({ token }: PortalAttendanceTabProps) {
  const [records, setRecords] = useState<PortalAttendanceRecord[]>([])
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([portalGetAttendance(token), portalGetPriceItems(token)])
      .then(([attendance, prices]) => {
        setRecords(attendance)
        setPriceItems(prices)
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-6">
      <PortalPriceListCard items={priceItems} loading={loading} />

      <Card>
        <h3 className="mb-2 text-base font-semibold text-theme-primary">Docházka</h3>
        <p className="mb-4 text-sm text-theme-muted">
          Evidence odpracovaného času z odeslaných denních formulářů. Po odeslání formuláře se záznam
          automaticky objeví zde.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Datum' },
              { key: 'order', label: 'Zakázka' },
              { key: 'status', label: 'Stav' },
              { key: 'start', label: 'Začátek' },
              { key: 'end', label: 'Konec' },
              { key: 'break', label: 'Přestávka' },
              { key: 'hours', label: 'Celkem hodin' },
            ]}
            isEmpty={records.length === 0}
            emptyMessage="Zatím nemáte žádnou docházku. Pošlete denní formulář a záznam se zde zobrazí."
          >
            {records.map((r) => (
              <DataTableRow key={r.id}>
                <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
                <DataTableCell>{r.order_name || '—'}</DataTableCell>
                <DataTableCell>{ATTENDANCE_STATUS_LABELS[r.attendance_status ?? 'pritomen']}</DataTableCell>
                <DataTableCell>{r.work_start ? formatTimeForInput(r.work_start) : '—'}</DataTableCell>
                <DataTableCell>{r.work_end ? formatTimeForInput(r.work_end) : '—'}</DataTableCell>
                <DataTableCell>{r.break_minutes ? `${r.break_minutes} min` : '—'}</DataTableCell>
                <DataTableCell>{r.hours} h</DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  )
}
