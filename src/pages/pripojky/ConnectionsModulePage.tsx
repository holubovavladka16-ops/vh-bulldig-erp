import { useCallback, useEffect, useState } from 'react'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { ConnectionFormModal } from '@/components/pripojky/ConnectionFormModal'
import { ConnectionDetailModal } from '@/components/pripojky/ConnectionDetailModal'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  fetchUtilityConnections,
  createUtilityConnection,
  updateUtilityConnection,
  deleteUtilityConnection,
} from '@/lib/pripojky/api'
import type {
  UtilityConnection,
  UtilityConnectionCreateInput,
  UtilityConnectionFilters,
  PendingConnectionPhoto,
} from '@/types/pripojky'
import { formatDate } from '@/constants/workers'

export function ConnectionsModulePage() {
  const { profile, user } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false

  const [connections, setConnections] = useState<UtilityConnection[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<UtilityConnectionFilters>({})
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editConnection, setEditConnection] = useState<UtilityConnection | null>(null)
  const [viewConnectionId, setViewConnectionId] = useState<string | null>(null)

  useEffect(() => {
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setConnections(await fetchUtilityConnections(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(data: UtilityConnectionCreateInput, photos: PendingConnectionPhoto[]) {
    if (!user) return
    await createUtilityConnection(data, photos, user.id)
    await load()
  }

  async function handleUpdate(data: UtilityConnectionCreateInput, photos: PendingConnectionPhoto[]) {
    if (!editConnection || !user) return
    await updateUtilityConnection(editConnection.id, data, photos, user.id)
    setEditConnection(null)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat tuto přípojku? Propojený zápis ve stavebním deníku bude také odstraněn.')) return
    await deleteUtilityConnection(id)
    await load()
  }

  const filterOrderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  return (
    <AppLayout>
      <PageHeader
        title="Přípojky"
        description="Evidence přípojek s fotografiemi a automatickým zápisem do stavebního deníku."
        action={
          isAdmin ? (
            <Button onClick={() => { setEditConnection(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />
              Přidat přípojku
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Zakázka"
            options={filterOrderOptions}
            value={filters.orderId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, orderId: e.target.value || undefined }))}
          />
          <Input label="Datum od" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))} />
          <Input label="Datum do" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'order', label: 'Zakázka' },
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'address', label: 'Adresa' },
            { key: 'length', label: 'Délka' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={connections.length === 0}
          emptyMessage="Žádné přípojky."
        >
          {connections.map((connection) => (
            <DataTableRow key={connection.id}>
              <DataTableCell>{formatDate(connection.connection_date)}</DataTableCell>
              <DataTableCell>{connection.order_name ?? '—'}</DataTableCell>
              <DataTableCell>{connection.worker_name ?? '—'}</DataTableCell>
              <DataTableCell>{connection.connection_address}</DataTableCell>
              <DataTableCell>{connection.length_meters} m</DataTableCell>
              <DataTableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setViewConnectionId(connection.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setEditConnection(connection); setFormOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(connection.id)}>
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

      <ConnectionFormModal
        open={formOpen}
        initial={editConnection}
        orderOptions={orderOptions}
        onClose={() => { setFormOpen(false); setEditConnection(null) }}
        onSubmit={editConnection ? handleUpdate : handleCreate}
      />

      <ConnectionDetailModal connectionId={viewConnectionId} onClose={() => setViewConnectionId(null)} />
    </AppLayout>
  )
}
