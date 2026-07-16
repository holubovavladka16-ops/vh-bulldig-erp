import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import type { Design6ActiveOrder } from '@/lib/dashboard/stats'

interface Design6ActiveOrdersProps {
  orders: Design6ActiveOrder[]
  loading?: boolean
}

export function Design6ActiveOrders({ orders, loading }: Design6ActiveOrdersProps) {
  return (
    <section className="design6-active-orders" aria-label="Aktivní zakázky">
      <div className="design6-active-orders__header">
        <h2 className="design6-section-title">Aktivní zakázky</h2>
        <Link to="/zakazky" className="design6-active-orders__link">
          Všechny zakázky
        </Link>
      </div>

      {loading ? (
        <p className="design6-active-orders__empty">Načítání zakázek…</p>
      ) : orders.length === 0 ? (
        <p className="design6-active-orders__empty">Momentálně nejsou aktivní zakázky.</p>
      ) : (
        <ul className="design6-active-orders__list">
          {orders.slice(0, 6).map((order) => (
            <li key={order.id}>
              <Link to={`/zakazky/${order.id}`} className="design6-active-orders__item">
                <span className="design6-active-orders__name">{order.name}</span>
                {order.location?.trim() && (
                  <span className="design6-active-orders__location">
                    <MapPin className="design6-active-orders__pin" aria-hidden="true" />
                    {order.location}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
