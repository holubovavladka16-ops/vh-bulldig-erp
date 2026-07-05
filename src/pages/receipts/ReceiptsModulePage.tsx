import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { ReceiptFiltersPanel } from '@/components/receipts/ReceiptFiltersPanel'
import { ReceiptFormModal } from '@/components/receipts/ReceiptFormModal'
import { ReceiptDetailModal } from '@/components/receipts/ReceiptDetailModal'
import { useAuth } from '@/context/AuthContext'
import { fetchJobOrders } from '@/lib/orders/api'
import { createReceipt, fetchReceipts, updateReceipt } from '@/lib/receipts/api'
import type { Receipt, ReceiptCaptureMeta, ReceiptCreateInput, ReceiptFilters } from '@/types/receipts'
import { formatCurrency, formatDate } from '@/constants/workers'

export function ReceiptsModulePage() {
  const { user } = useAuth()

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<ReceiptFilters>({})
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null)
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReceipts(await fetchReceipts(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSubmit(data: ReceiptCreateInput, capture: ReceiptCaptureMeta | null) {
    if (editReceipt) {
      await updateReceipt(editReceipt.id, data)
    } else if (user && capture) {
      await createReceipt(data, capture, user.id)
    }
    setEditReceipt(null)
    await load()
  }

  function openCreate() {
    setEditReceipt(null)
    setFormOpen(true)
  }

  function openEdit(receipt: Receipt) {
    setDetailReceipt(null)
    setEditReceipt(receipt)
    setFormOpen(true)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Paragony"
        description="Evidence paragonů a účtenek pro účetnictví, propojených se zakázkami."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Přidat paragon
          </Button>
        }
      />

      <ReceiptFiltersPanel filters={filters} orderOptions={orderOptions} onChange={setFilters} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'order', label: 'Zakázka' },
            { key: 'name', label: 'Název výdaje' },
            { key: 'price', label: 'Cena', className: 'text-right' },
          ]}
          isEmpty={receipts.length === 0}
          emptyMessage="Žádné paragony."
        >
          {receipts.map((receipt) => (
            <DataTableRow key={receipt.id}>
              <DataTableCell>
                <button
                  type="button"
                  onClick={() => setDetailReceipt(receipt)}
                  className="text-left hover:text-accent hover:underline"
                >
                  {formatDate(receipt.receipt_date)}
                </button>
              </DataTableCell>
              <DataTableCell>{receipt.order_name ?? '—'}</DataTableCell>
              <DataTableCell>{receipt.expense_name}</DataTableCell>
              <DataTableCell className="text-right font-medium">
                {receipt.amount != null ? formatCurrency(receipt.amount) : '—'}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <ReceiptFormModal
        open={formOpen}
        initial={editReceipt}
        orderOptions={orderOptions}
        onClose={() => { setFormOpen(false); setEditReceipt(null) }}
        onSubmit={handleSubmit}
      />

      <ReceiptDetailModal
        receipt={detailReceipt}
        onClose={() => setDetailReceipt(null)}
        onEdit={openEdit}
        onDeleted={load}
      />
    </AppLayout>
  )
}
