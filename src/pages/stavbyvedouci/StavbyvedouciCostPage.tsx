import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CostFormModal } from '@/components/costs/CostFormModal'
import { useAuth } from '@/context/AuthContext'
import { JOB_COST_CATEGORY_LABELS } from '@/constants/costs'
import { formatCurrency, formatDate } from '@/constants/workers'
import { uploadJobCostDocument, uploadJobCostPhoto } from '@/lib/costs/api'
import {
  createStavbyvedouciCost,
  fetchAssignedProjectsWithMarkers,
  fetchMyCosts,
} from '@/lib/stavbyvedouci/api'
import type { JobCostCreateInput } from '@/types/costs'

export function StavbyvedouciCostPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [defaultOrderId, setDefaultOrderId] = useState<string | undefined>()
  const [costs, setCosts] = useState<
    Awaited<ReturnType<typeof fetchMyCosts>>
  >([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [projects, myCosts] = await Promise.all([
        fetchAssignedProjectsWithMarkers(),
        fetchMyCosts(user.id),
      ])
      const options = projects.map((item) => ({
        value: item.project_id,
        label: `${item.order.name} – ${item.order.location}`,
      }))
      setOrderOptions(options)
      setCosts(myCosts)

      const prefill = searchParams.get('orderId')
      if (prefill && options.some((option) => option.value === prefill)) {
        setDefaultOrderId(prefill)
      } else if (options.length === 1) {
        setDefaultOrderId(options[0].value)
      }
    } finally {
      setLoading(false)
    }
  }, [searchParams, user])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(data: JobCostCreateInput, files: { pdf?: File; photos: File[] }) {
    if (!user) return
    await createStavbyvedouciCost(data, user.id)
    const savedCosts = await fetchMyCosts(user.id)
    const latest = savedCosts[0]
    if (!latest) {
      await load()
      return
    }

    if (files.pdf) {
      await uploadJobCostDocument(latest.id, files.pdf, user.id)
    }
    for (const photo of files.photos) {
      await uploadJobCostPhoto(latest.id, photo, user.id)
    }
    await load()
  }

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 min-h-[44px]" onClick={() => navigate('/stavbyvedouci')}>
        <ArrowLeft className="h-4 w-4" />
        Zpět
      </Button>

      <PageHeader
        title="Zapsat náklad"
        description="Náklady pouze k přiděleným zakázkám – bez přehledu firemní ekonomiky."
        action={
          <Button className="min-h-[44px]" onClick={() => setModalOpen(true)} disabled={orderOptions.length === 0}>
            <Plus className="h-4 w-4" />
            Nový náklad
          </Button>
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {orderOptions.length === 0 && !loading ? (
          <Card className="p-4 text-sm text-theme-muted">
            Nemáte aktivní přiřazení k žádné zakázce – náklad nelze zapsat.
          </Card>
        ) : null}

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-theme-primary">Moje rozepsané náklady</h2>
          {loading ? (
            <p className="text-sm text-theme-muted">Načítám…</p>
          ) : costs.length === 0 ? (
            <p className="text-sm text-theme-muted">Zatím nemáte žádné zapsané náklady.</p>
          ) : (
            <ul className="space-y-3">
              {costs.map((cost) => (
                <li key={cost.id} className="rounded-xl border border-white/10 px-3 py-3 text-sm">
                  <p className="font-medium text-theme-primary">{cost.name}</p>
                  <p className="text-theme-muted">
                    {cost.job_orders?.name ?? 'Zakázka'} · {formatDate(cost.cost_date)}
                  </p>
                  <p className="mt-1 text-theme-secondary">
                    {JOB_COST_CATEGORY_LABELS[cost.category as keyof typeof JOB_COST_CATEGORY_LABELS] ??
                      cost.category}{' '}
                    · {formatCurrency(Number(cost.price))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <CostFormModal
        open={modalOpen}
        defaultOrderId={defaultOrderId}
        orderOptions={orderOptions}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </AppLayout>
  )
}
