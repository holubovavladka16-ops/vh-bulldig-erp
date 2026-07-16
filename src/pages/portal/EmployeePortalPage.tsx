import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { portalGetWorker } from '@/lib/workers/api'
import { isValidPortalToken } from '@/lib/workers/portalToken'
import { PortalDailyFormTab, PortalLayout } from '@/pages/portal/PortalDailyFormTab'
import { PortalReportsTab } from '@/pages/portal/PortalReportsTab'
import { PortalEarningsTab } from '@/pages/portal/PortalEarningsTab'
import { PortalAttendanceTab } from '@/pages/portal/PortalAttendanceTab'
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
      <div className="field-mode flex min-h-dvh items-center justify-center p-6">
        <div className="field-mode-card max-w-md text-center">
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
      <div className="field-mode flex min-h-dvh items-center justify-center p-6">
        <div className="field-mode-card max-w-md text-center">
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
      <div className="field-mode flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--field-gold,#c9a227)]" />
      </div>
    )
  }

  return (
    <PortalLayout workerName={`${worker.first_name} ${worker.last_name}`}>
      <nav className="field-mode-nav" aria-label="Portál zaměstnance">
        {PORTAL_TABS.map((t) => (
          <Link
            key={t.id}
            to={`/portal/${token}/${t.id}`}
            className={`field-mode-nav__link ${activeTab === t.id ? 'field-mode-nav__link--active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'denni-formular' && <PortalDailyFormTab token={token} />}
      {activeTab === 'moje-dochazka' && <PortalAttendanceTab token={token} />}
      {activeTab === 'muj-vykaz' && <PortalReportsTab token={token} />}
      {activeTab === 'prehled-vydelku' && <PortalEarningsTab token={token} />}
    </PortalLayout>
  )
}
