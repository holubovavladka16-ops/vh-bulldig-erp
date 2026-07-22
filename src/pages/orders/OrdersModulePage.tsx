import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Archive, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { OrderFormModal } from '@/components/orders/OrderFormModal'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import {
  fetchJobOrders,
  createJobOrder,
  updateJobOrder,
  archiveJobOrder,
  deleteJobOrder,
} from '@/lib/orders/api'
import type { JobOrder, JobOrderFilters, JobOrderStatus } from '@/types/orders'
import { JOB_ORDER_STATUS_LABELS, JOB_ORDER_STATUS_OPTIONS } from '@/constants/orders'
import { getOrderStatusBadgeVariant } from '@/constants/orderStatusBadge'
import { formatDate } from '@/constants/workers'

export function OrdersModulePage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile ? isAdministrator(profile.role) : false

  const [orders, setOrders] = useState<JobOrder[]>([])
  const [filters, setFilters] = useState<JobOrderFilters>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<JobOrder | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await fetchJobOrders(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(data: Parameters<typeof createJobOrder>[0]) {
    if (!user) return
    await createJobOrder(data, user.id)
    await load()
  }

  async function handleUpdate(data: Parameters<typeof createJobOrder>[0]) {
    if (!editOrder) return
    await updateJobOrder(editOrder.id, data)
    setEditOrder(null)
    await load()
  }

  async function handleArchive(id: string) {
    if (!confirm('Archivovat tuto zakázku?')) return
    await archiveJobOrder(id)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Trvale smazat tuto zakázku?')) return
    await deleteJobOrder(id)
    await load()
  }

  const statusOptions = [{ value: '', label: 'Všechny stavy' }, ...JOB_ORDER_STATUS_OPTIONS]

  return (
    <AppLayout>
      <PageHeader
        title="Zakázky"
        description="Správa stavebních zakázek a automatické propojení s formuláři zaměstnanců."
        action={
          isAdmin ? (
            <Button onClick={() => { setEditOrder(null); setModalOpen(true) }}>
              <Plus className="h-4 w-4" />
              Přidat zakázku
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-[2.45rem] h-4 w-4 text-theme-muted" />
            <Input
              label="Vyhledávání"
              value={filters.search ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Název nebo místo realizace…"
              className="pl-9"
            />
          </div>
          <Input
            label="Místo realizace"
            value={filters.location ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value || undefined }))}
          />
          <Select
            label="Stav"
            options={statusOptions}
            value={filters.status ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: (e.target.value as JobOrderStatus) || '' }))}
          />
          <Input label="Období od" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))} />
          <Input label="Období do" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Název' },
            { key: 'location', label: 'Místo' },
            { key: 'dates', label: 'Období' },
            { key: 'status', label: 'Stav' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={orders.length === 0}
          emptyMessage="Žádné zakázky."
        >
          {orders.map((order) => (
            <DataTableRow key={order.id}>
              <DataTableCell>
                <div>
                  <p className="font-medium text-theme-primary">{order.name}</p>
                  {order.order_number && <p className="text-xs text-theme-muted">{order.order_number}</p>}
                </div>
              </DataTableCell>
              <DataTableCell>{order.location}</DataTableCell>
              <DataTableCell>{formatDate(order.start_date)} – {formatDate(order.end_date)}</DataTableCell>
              <DataTableCell>
                <StatusBadge label={JOB_ORDER_STATUS_LABELS[order.status]} variant={getOrderStatusBadgeVariant(order.status)} />
              </DataTableCell>
              <DataTableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/zakazky/${order.id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setEditOrder(order); setModalOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {order.status !== 'archivovana' && (
                        <Button variant="ghost" size="sm" onClick={() => handleArchive(order.id)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(order.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <OrderFormModal
        open={modalOpen}
        initial={editOrder}
        onClose={() => { setModalOpen(false); setEditOrder(null) }}
        onSubmit={editOrder ? handleUpdate : handleCreate}
      />
    </AppLayout>
  )
}
