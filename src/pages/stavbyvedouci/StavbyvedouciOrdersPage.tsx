import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import { JOB_ORDER_STATUS_LABELS } from '@/constants/orders'
import { fetchAssignedProjectsWithMarkers } from '@/lib/stavbyvedouci/api'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export function StavbyvedouciOrdersPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ProjectMapMarkerWithOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchAssignedProjectsWithMarkers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 min-h-[44px]" onClick={() => navigate('/stavbyvedouci')}>
        <ArrowLeft className="h-4 w-4" />
        Zpět
      </Button>

      <PageHeader
        title="Moje zakázky"
        description="Zobrazují se pouze zakázky s aktivním přiřazením (RLS)."
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-white/10 p-4 text-sm text-theme-muted">
            Nemáte aktivní přiřazení k žádné zakázce.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.project_id}
              className="glass-panel neon-border rounded-2xl p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-theme-primary">{item.order.name}</h2>
                  <p className="text-sm text-theme-muted">{item.order.location}</p>
                </div>
                <MarkerColorBadge color={item.marker_color} label={item.color_label} />
              </div>
              <dl className="mt-3 grid gap-1 text-sm">
                <div>
                  <dt className="text-theme-muted">Stav zakázky</dt>
                  <dd className="text-theme-primary">{JOB_ORDER_STATUS_LABELS[item.order.status]}</dd>
                </div>
                <div>
                  <dt className="text-theme-muted">Stav špendlíku</dt>
                  <dd className="text-theme-primary">{item.color_label}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button className="min-h-[44px] flex-1" onClick={() => navigate(`/zakazky/${item.project_id}`)}>
                  Otevřít zakázku
                </Button>
                <Link
                  to={`/zakazky-mapa?projectId=${item.project_id}`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-theme-primary hover:bg-white/5"
                >
                  <MapPin className="h-4 w-4" />
                  Mapa
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </AppLayout>
  )
}
