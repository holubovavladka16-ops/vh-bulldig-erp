import { User } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import type { PortalWorker } from '@/types/workers'
import type { ActiveJobOrderOption } from '@/types/orders'

interface FieldModeWorkerCardProps {
  worker: PortalWorker
  orderId: string
  orders: ActiveJobOrderOption[]
  onOrderChange: (orderId: string) => void
  disabled?: boolean
  presenceLabel: string
}

export function FieldModeWorkerCard({
  worker,
  orderId,
  orders,
  onOrderChange,
  disabled,
  presenceLabel,
}: FieldModeWorkerCardProps) {
  const selectedOrder = orders.find((o) => o.id === orderId)
  const initials = `${worker.first_name.charAt(0)}${worker.last_name.charAt(0)}`.toUpperCase()

  return (
    <FieldModeCard title="Pracovník" icon="👷">
      <div className="field-mode-worker">
        <div className="field-mode-worker__photo" aria-hidden="true">
          <span className="field-mode-worker__initials">{initials}</span>
          <User className="field-mode-worker__icon" />
        </div>
        <div className="field-mode-worker__info">
          <p className="field-mode-worker__name">
            {worker.first_name} {worker.last_name}
          </p>
          <p className="field-mode-worker__meta">{worker.position || '—'}</p>
          <div className="field-mode-worker__order">
            <label htmlFor="field-order">Zakázka</label>
            {orders.length === 0 ? (
              <p className="text-red-300">Žádná aktivní zakázka</p>
            ) : (
              <select
                id="field-order"
                value={orderId}
                disabled={disabled}
                onChange={(e) => onOrderChange(e.target.value)}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedOrder?.location && (
            <p className="field-mode-worker__meta">Středisko: {selectedOrder.location}</p>
          )}
          <p className={`field-mode-worker__status ${presenceLabel === 'Přítomen' ? 'field-mode-worker__status--active' : ''}`}>
            Stav: <strong>{presenceLabel}</strong>
          </p>
        </div>
      </div>
    </FieldModeCard>
  )
}
