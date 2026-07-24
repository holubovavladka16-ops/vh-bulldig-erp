import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { CostFormModal } from '@/components/costs/CostFormModal'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  fetchJobCosts,
  createJobCost,
  updateJobCost,
  deleteJobCost,
  uploadJobCostDocument,
  uploadJobCostPhoto,
} from '@/lib/costs/api'
import type { JobCost, JobCostCreateInput, JobCostFilters } from '@/types/costs'
import { JOB_COST_CATEGORY_LABELS } from '@/constants/costs'
import { formatCurrency, formatDate } from '@/constants/workers'

export function CostsModulePage() {
  const { profile, user } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false

  const [costs, setCosts] = useState<JobCost[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<JobCostFilters>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editCost, setEditCost] = useState<JobCost | null>(null)

  useEffect(() => {
    fetchJobOrders()
      .then((orders) =>
        setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name })))
      )
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCosts(await fetchJobCosts(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function saveCost(
    data: JobCostCreateInput,
    files: { pdf?: File; photos: File[] },
    costId?: string
  ) {
    if (!user) return

    const saved = costId
      ? await updateJobCost(costId, data)
      : await createJobCost(data, user.id)

    if (files.pdf) {
      await uploadJobCostDocument(saved.id, files.pdf, user.id)
    }
    for (const photo of files.photos) {
      await uploadJobCostPhoto(saved.id, photo, user.id)
    }

    await load()
  }

  async function handleCreate(data: JobCostCreateInput, files: { pdf?: File; photos: File[] }) {
    await saveCost(data, files)
  }

  async function handleUpdate(data: JobCostCreateInput, files: { pdf?: File; photos: File[] }) {
    if (!editCost) return
    await saveCost(data, files, editCost.id)
    setEditCost(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Trvale smazat tento náklad?')) return
    await deleteJobCost(id)
    await load()
  }

  const filterOrderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  return (
    <AppLayout>
      <PageHeader
        title="Náklady"
        description="Evidence nákladů na stavebních zakázkách."
        action={
          isAdmin ? (
            <Button onClick={() => { setEditCost(null); setModalOpen(true) }}>
              <Plus className="h-4 w-4" />
              Přidat náklad
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
          <Input
            label="Datum od"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))}
          />
          <Input
            label="Datum do"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
          />
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
            { key: 'name', label: 'Název nákladu' },
            { key: 'category', label: 'Kategorie' },
            { key: 'price', label: 'Cena', className: 'text-right' },
            ...(isAdmin ? [{ key: 'actions', label: 'Akce', className: 'text-right' }] : []),
          ]}
          isEmpty={costs.length === 0}
          emptyMessage="Žádné náklady."
        >
          {costs.map((cost) => (
            <DataTableRow key={cost.id}>
              <DataTableCell>{formatDate(cost.cost_date)}</DataTableCell>
              <DataTableCell>{cost.order_name ?? '—'}</DataTableCell>
              <DataTableCell>{cost.name}</DataTableCell>
              <DataTableCell>{JOB_COST_CATEGORY_LABELS[cost.category ?? 'ostatni']}</DataTableCell>
              <DataTableCell className="text-right font-medium">{formatCurrency(cost.price)}</DataTableCell>
              {isAdmin && (
                <DataTableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditCost(cost); setModalOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(cost.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </DataTableCell>
              )}
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <CostFormModal
        open={modalOpen}
        initial={editCost}
        orderOptions={orderOptions}
        onClose={() => { setModalOpen(false); setEditCost(null) }}
        onSubmit={editCost ? handleUpdate : handleCreate}
      />
    </AppLayout>
  )
}
