import { useEffect, useState } from 'react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { PortalPriceListCard } from '@/components/portal/PortalPriceListCard'
import { portalGetPriceItems } from '@/lib/workers/api'
import { portalGetAttendance } from '@/lib/workers/module5'
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
    <div className="field-mode-grid">
      <div className="field-mode-grid__full">
        <PortalPriceListCard items={priceItems} loading={loading} />
      </div>

      <FieldModeCard title="Docházka" icon="⏱️" className="field-mode-grid__full">
        <p className="mb-4 text-sm text-theme-muted">
          Po odeslání denního formuláře se záznam automaticky zobrazí zde i u administrátora.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--field-gold,#c9a227)]" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-theme-muted">Zatím nemáte žádnou docházku.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="field-mode-history-item !cursor-default">
                <div>
                  <p className="font-semibold text-theme-primary">{formatDate(r.attendance_date)}</p>
                  <p className="text-sm text-theme-secondary">{r.order_name || '—'}</p>
                  <p className="text-xs text-theme-muted">
                    {r.work_start && r.work_end
                      ? `${formatTimeForInput(r.work_start)}–${formatTimeForInput(r.work_end)} · ${r.hours} h`
                      : `${r.hours} h`}
                  </p>
                </div>
                <span className="text-sm text-[var(--field-gold)]">{r.note ? 'Pozn.' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </FieldModeCard>
    </div>
  )
}
