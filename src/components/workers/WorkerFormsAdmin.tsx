import { useEffect, useState, useCallback } from 'react'
import { X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DailyFormFields,
  formStateFromWorkerForm,
  type DailyFormState,
} from '@/components/workers/DailyFormFields'
import { fetchJobOrderOptions } from '@/lib/orders/api'
import {
  adminGetFormTaskItems,
  adminSaveForm,
  fetchPriceItems,
  fetchForms,
  approveForm,
  returnFormForCorrection,
} from '@/lib/workers/api'
import { filterTaskLinesForSave } from '@/lib/workers/earnings'
import type { WorkerDailyForm, WorkerPriceItem } from '@/types/workers'
import { WORK_TYPE_LABELS, WORKER_FORM_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader } from '@/components/ui/Card'

interface WorkerFormsAdminProps {
  workerId: string
  isAdmin: boolean
}

export function WorkerFormsAdmin({ workerId, isAdmin }: WorkerFormsAdminProps) {
  const { user } = useAuth()
  const [forms, setForms] = useState<WorkerDailyForm[]>([])
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState<WorkerDailyForm | null>(null)
  const [editState, setEditState] = useState<DailyFormState | null>(null)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [f, items, orders] = await Promise.all([
      fetchForms(workerId),
      fetchPriceItems(workerId),
      fetchJobOrderOptions(),
    ])
    setForms(f)
    setPriceItems(items)
    setOrderOptions(orders)
    setLoading(false)
  }, [workerId])

  useEffect(() => {
    load()
  }, [workerId, load])

  async function openEdit(form: WorkerDailyForm) {
    const tasks = await adminGetFormTaskItems(form.id)
    setEditForm(form)
    setEditState(
      formStateFromWorkerForm(
        form,
        tasks.map((t) => ({ price_item_id: t.price_item_id, quantity: t.quantity }))
      )
    )
  }

  async function handleSaveEdit() {
    if (!editForm || !editState || !isAdmin) return
    setSaving(true)
    try {
      await adminSaveForm(editForm.id, {
        form_date: editState.formDate,
        order_id: editState.orderId,
        work_type: editState.workType,
        work_description: editState.workDescription,
        work_start: editState.workStart,
        work_end: editState.workEnd,
        break_minutes: parseInt(editState.breakMinutes, 10) || 0,
        advance: parseFloat(editState.advance) || 0,
        material: editState.material,
        note: editState.note,
        gps_lat: editState.gpsLat,
        gps_lng: editState.gpsLng,
        gps_accuracy: editState.gpsAccuracy,
        signature_data: editState.signatureData,
        task_items: filterTaskLinesForSave(editState.taskLines, priceItems),
      })
      setEditForm(null)
      setEditState(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(formId: string) {
    if (!user) return
    await approveForm(formId, workerId, user.id)
    await load()
  }

  async function handleReturn(formId: string) {
    if (!user) return
    await returnFormForCorrection(formId, workerId, user.id)
    await load()
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" /></div>
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader title="Denní formuláře" description="Správa a schvalování formulářů zaměstnance" />
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'type', label: 'Typ práce' },
            { key: 'order', label: 'Zakázka' },
            { key: 'hours', label: 'Hodiny' },
            { key: 'earnings', label: 'Výdělek' },
            { key: 'status', label: 'Stav' },
            ...(isAdmin ? [{ key: 'actions', label: 'Akce' }] : []),
          ]}
          isEmpty={forms.length === 0}
          emptyMessage="Žádné formuláře."
        >
          {forms.map((f) => (
            <DataTableRow key={f.id}>
              <DataTableCell>{formatDate(f.form_date)}</DataTableCell>
              <DataTableCell>{WORK_TYPE_LABELS[f.work_type ?? 'ukolova']}</DataTableCell>
              <DataTableCell>{f.order_name || '—'}</DataTableCell>
              <DataTableCell>{f.hours} h</DataTableCell>
              <DataTableCell>{formatCurrency(f.earnings)}</DataTableCell>
              <DataTableCell>
                <StatusBadge label={WORKER_FORM_STATUS_LABELS[f.status]} variant={f.status === 'schvaleny' ? 'success' : 'info'} />
              </DataTableCell>
              {isAdmin && (
                <DataTableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(f)} aria-label="Upravit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {f.status === 'odeslany' && (
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(f.id)}>Schválit</Button>
                    )}
                    {(f.status === 'odeslany' || f.status === 'schvaleny') && (
                      <Button variant="ghost" size="sm" onClick={() => handleReturn(f.id)}>K opravě</Button>
                    )}
                  </div>
                </DataTableCell>
              )}
            </DataTableRow>
          ))}
        </DataTable>
      </Card>

      {editForm && editState && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setEditForm(null)} aria-hidden="true" />
          <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-theme-primary">Upravit formulář</h3>
              <button onClick={() => setEditForm(null)} className="rounded-lg p-1.5 hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DailyFormFields
              state={editState}
              priceItems={priceItems}
              orderOptions={orderOptions}
              onChange={(patch) => setEditState((prev) => (prev ? { ...prev, ...patch } : prev))}
              isAdmin
            />
            <div className="modal-footer mt-4 pt-2">
              <Button variant="secondary" onClick={() => setEditForm(null)}>Zrušit</Button>
              <Button onClick={handleSaveEdit} loading={saving}>Uložit změny</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
