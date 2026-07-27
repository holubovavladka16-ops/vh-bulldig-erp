import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import {
  CALENDAR_DAY_STATUS_LABELS,
  type CalendarDayStatus,
} from '@/lib/dailyCalendar/types'
import type { DailyOrderOption } from '@/lib/dailyCalendar/api'

const STATUS_OPTIONS = (Object.keys(CALENDAR_DAY_STATUS_LABELS) as CalendarDayStatus[]).map(
  (value) => ({ value, label: CALENDAR_DAY_STATUS_LABELS[value] })
)

interface DayInfoSectionProps {
  dateLabel: string
  status: CalendarDayStatus
  onStatusChange: (status: CalendarDayStatus) => void
  orderId: string | null
  onOrderChange: (orderId: string) => void
  orders: DailyOrderOption[]
  ordersLoading: boolean
}

/**
 * Informace dne – datum, stav a zakázka.
 * Zakázka se vybírá z reálného seznamu aktivních zakázek načteného ze Supabase
 * (`job_orders`) – bez výběru zakázky nelze denní záznam uložit (order_id je
 * v databázi povinný, viz migrace 083).
 */
export function DayInfoSection({
  dateLabel,
  status,
  onStatusChange,
  orderId,
  onOrderChange,
  orders,
  ordersLoading,
}: DayInfoSectionProps) {
  const orderOptions = [
    { value: '', label: ordersLoading ? 'Načítám zakázky…' : 'Vyberte zakázku…' },
    ...orders.map((order) => ({ value: order.id, label: order.name })),
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Datum" value={dateLabel} readOnly disabled />

      <Select
        label="Stav"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as CalendarDayStatus)}
        options={STATUS_OPTIONS}
      />

      <div className="sm:col-span-2">
        <Select
          label="Zakázka"
          value={orderId ?? ''}
          onChange={(e) => onOrderChange(e.target.value)}
          options={orderOptions}
          disabled={ordersLoading}
          hint="Denní záznam se uloží až po výběru zakázky."
        />
      </div>
    </div>
  )
}
