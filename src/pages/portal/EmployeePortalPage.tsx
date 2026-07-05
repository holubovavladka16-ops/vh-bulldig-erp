import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { portalGetWorker } from '@/lib/workers/api'
import { isValidPortalToken } from '@/lib/workers/portalToken'
import { PortalLayout, PortalDailyFormTab } from '@/pages/portal/PortalDailyFormTab'
import { PortalReportsTab } from '@/pages/portal/PortalReportsTab'
import { PortalEarningsTab } from '@/pages/portal/PortalEarningsTab'
import { LEGACY_PORTAL_TAB_REDIRECTS, PORTAL_TABS } from '@/constants/workers'
import type { PortalTabId, PortalWorker } from '@/types/workers'

export function EmployeePortalPage() {
  const { token, tab } = useParams<{ token: string; tab?: string }>()
  const [worker, setWorker] = useState<PortalWorker | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const legacyRedirect = tab ? LEGACY_PORTAL_TAB_REDIRECTS[tab] : undefined
  const activeTab = (
    PORTAL_TABS.some((t) => t.id === tab) ? tab : legacyRedirect ?? 'denni-formular'
  ) as PortalTabId

  useEffect(() => {
    if (!token || !isValidPortalToken(token)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    portalGetWorker(token)
      .then((w) => {
        if (!w) setNotFound(true)
        else setWorker(w)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (!token || !isValidPortalToken(token)) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center p-6">
        <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">Odkaz není platný</h1>
          <p className="mt-2 text-theme-secondary">Formát odkazu zaměstnance není platný.</p>
        </div>
      </div>
    )
  }

  if (legacyRedirect && tab !== legacyRedirect) {
    return <Navigate to={`/portal/${token}/${legacyRedirect}`} replace />
  }

  if (!loading && notFound) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center p-6">
        <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">Odkaz není platný</h1>
          <p className="mt-2 text-theme-secondary">
            Portál zaměstnance není dostupný. Kontaktujte administrátora pro nový odkaz.
          </p>
        </div>
      </div>
    )
  }

  if (loading || !worker) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <PortalLayout workerName={`${worker.first_name} ${worker.last_name}`}>
      <div className="mb-6 flex flex-wrap gap-2">
        {PORTAL_TABS.map((t) => (
          <Link
            key={t.id}
            to={`/portal/${token}/${t.id}`}
            className={`flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
              activeTab === t.id
                ? 'nav-item-active text-accent'
                : 'text-theme-secondary hover:bg-white/5 neon-border border-transparent'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === 'denni-formular' && <PortalDailyFormTab token={token} />}
      {activeTab === 'muj-vykaz' && <PortalReportsTab token={token} />}
      {activeTab === 'prehled-vydelku' && <PortalEarningsTab token={token} />}
    </PortalLayout>
  )
}
