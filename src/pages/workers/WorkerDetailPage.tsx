import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorkerTabs } from '@/components/workers/WorkerTabs'
import { PersonalTab } from '@/components/workers/tabs/PersonalTab'
import { PriceListTab } from '@/components/workers/tabs/PriceListTab'
import { DocumentsTab } from '@/components/workers/tabs/DocumentsTab'
import { ReportsTab } from '@/components/workers/tabs/ReportsTab'
import { AttendanceTab } from '@/components/workers/tabs/AttendanceTab'
import { HistoryTab } from '@/components/workers/tabs/HistoryTab'
import { FormLinkTab } from '@/components/workers/tabs/FormLinkTab'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { fetchWorker } from '@/lib/workers/api'
import type { Worker, WorkerTabId } from '@/types/workers'

const VALID_TABS: WorkerTabId[] = [
  'osobni-karta', 'cenik', 'dokumenty', 'vykazy', 'dochazka', 'historie', 'formular',
]

export function WorkerDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>()
  const { profile } = useAuth()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [loading, setLoading] = useState(true)

  const activeTab = (VALID_TABS.includes(tab as WorkerTabId) ? tab : 'osobni-karta') as WorkerTabId
  const isAdmin = profile ? isAdministrator(profile.role) : false

  useEffect(() => {
    if (!id) return
    fetchWorker(id).then(setWorker).finally(() => setLoading(false))
  }, [id])

  if (!id) return <Navigate to="/delnici" replace />
  if (!loading && !worker) return <Navigate to="/delnici" replace />
  if (tab && !VALID_TABS.includes(tab as WorkerTabId)) {
    return <Navigate to={`/delnici/${id}/osobni-karta`} replace />
  }

  if (loading || !worker) {
    return (
      <AppLayout title="Dělníci">
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={`${worker.first_name} ${worker.last_name}`}>
      <Link to="/delnici" className="mb-4 inline-flex items-center gap-2 text-sm text-theme-secondary hover:text-accent">
        <ArrowLeft className="h-4 w-4" />Zpět na seznam
      </Link>

      <WorkerTabs workerId={worker.id} activeTab={activeTab} />

      {activeTab === 'osobni-karta' && <PersonalTab worker={worker} isAdmin={isAdmin} onUpdate={setWorker} />}
      {activeTab === 'cenik' && <PriceListTab workerId={worker.id} isAdmin={isAdmin} />}
      {activeTab === 'dokumenty' && <DocumentsTab worker={worker} isAdmin={isAdmin} />}
      {activeTab === 'vykazy' && <ReportsTab workerId={worker.id} isAdmin={isAdmin} />}
      {activeTab === 'dochazka' && (
        <AttendanceTab
          workerId={worker.id}
          workerLabel={`${worker.last_name} ${worker.first_name}`}
          isAdmin={isAdmin}
        />
      )}
      {activeTab === 'historie' && <HistoryTab workerId={worker.id} />}
      {activeTab === 'formular' && <FormLinkTab worker={worker} onWorkerUpdated={setWorker} />}
    </AppLayout>
  )
}
