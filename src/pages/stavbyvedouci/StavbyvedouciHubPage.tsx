import { Clock, BookOpen, Landmark, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import { ProjectNotificationsPanel } from '@/components/zakazkyMapa/ProjectNotificationsPanel'
import { useAuth } from '@/context/AuthContext'
import { JOB_ORDER_STATUS_LABELS } from '@/constants/orders'
import { DIARY_ENTRY_STATUS_LABELS } from '@/constants/diary'
import {
  fetchAssignedProjectsWithMarkers,
  fetchMyDiaryEntries,
  groupDiaryByStatus,
} from '@/lib/stavbyvedouci/api'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConstructionDiaryEntry } from '@/types/diary'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

const MAIN_ACTIONS = [
  {
    label: 'Zapsat docházku',
    description: 'Příchod, odchod a přestávka u přidělené zakázky',
    path: '/stavbyvedouci/dochazka',
    icon: Clock,
  },
  {
    label: 'Zapsat náklad',
    description: 'Materiál, PHM nebo účtenka k přidělené zakázce',
    path: '/stavbyvedouci/naklad',
    icon: Landmark,
  },
  {
    label: 'Zapsat stavební deník',
    description: 'Denní zápis prací, techniky a počasí',
    path: '/stavbyvedouci/denik',
    icon: BookOpen,
  },
] as const

export function StavbyvedouciHubPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<ProjectMapMarkerWithOrder[]>([])
  const [entries, setEntries] = useState<ConstructionDiaryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projectRows, diaryRows] = await Promise.all([
        fetchAssignedProjectsWithMarkers(),
        profile ? fetchMyDiaryEntries(profile.id) : Promise.resolve([]),
      ])
      setProjects(projectRows)
      setEntries(diaryRows)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => groupDiaryByStatus(entries), [entries])

  return (
    <AppLayout>
      <PageHeader
        title="Pracovní přehled"
        description={
          profile
            ? `Vítejte, ${profile.full_name}. Zde spravujete pouze své přidělené zakázky.`
            : 'Přehled přidělených zakázek'
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <section className="grid gap-3 sm:grid-cols-1">
          {MAIN_ACTIONS.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="glass-panel neon-border flex min-h-[72px] items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.03]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                <action.icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-theme-primary">{action.label}</span>
                <span className="block text-sm text-theme-muted">{action.description}</span>
              </span>
            </Link>
          ))}
        </section>

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-theme-primary">Moje zakázky</h2>
            <Link to="/stavbyvedouci/zakazky" className="text-sm text-accent hover:underline">
              Zobrazit vše
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-theme-muted">Načítám přidělené zakázky…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-theme-muted">Nemáte aktivní přiřazení k žádné zakázce.</p>
          ) : (
            <ul className="space-y-3">
              {projects.slice(0, 4).map((item) => (
                <li
                  key={item.project_id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-theme-primary">{item.order.name}</p>
                      <p className="text-sm text-theme-muted">{item.order.location}</p>
                    </div>
                    <MarkerColorBadge color={item.marker_color} label={item.color_label} />
                  </div>
                  <p className="mt-2 text-xs text-theme-muted">
                    {JOB_ORDER_STATUS_LABELS[item.order.status]} · {item.color_label}
                  </p>
                  <Link
                    to={`/zakazky/${item.project_id}`}
                    className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-accent hover:underline"
                  >
                    Otevřít zakázku
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ProjectNotificationsPanel showResolved={false} />

        <Card className="space-y-4 p-4">
          <h2 className="text-lg font-semibold text-theme-primary">Moje záznamy</h2>
          <RecordSection title="Rozepsané" entries={grouped.draft} />
          <RecordSection title="Čeká na kontrolu" entries={grouped.pending} />
          <RecordSection title="Vrácené k opravě" entries={grouped.returned} />
        </Card>

        <Link
          to="/zakazky-mapa"
          className="glass-panel neon-border flex min-h-[56px] items-center justify-center gap-2 rounded-2xl p-4 text-sm font-medium text-theme-primary hover:bg-white/[0.03]"
        >
          <MapPin className="h-5 w-5 text-accent" />
          Otevřít mapu přidělených zakázek
        </Link>
      </div>
    </AppLayout>
  )
}

function RecordSection({
  title,
  entries,
}: {
  title: string
  entries: ConstructionDiaryEntry[]
}) {
  if (entries.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-theme-muted">{title}</h3>
        <p className="mt-1 text-sm text-theme-muted">Žádné záznamy</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-theme-primary">
        {title} ({entries.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {entries.slice(0, 5).map((entry) => (
          <li key={entry.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
            <span className="font-medium text-theme-primary">{entry.order_name ?? 'Zakázka'}</span>
            <span className="text-theme-muted"> · {entry.entry_date}</span>
            <span className="block text-xs text-theme-muted">
              {DIARY_ENTRY_STATUS_LABELS[entry.entry_status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
