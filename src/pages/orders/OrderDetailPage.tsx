import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, FileText, Download, ExternalLink } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator, canManageProjectAssignments, isStavbyvedouci } from '@/constants/permissions'
import { ProjectMarkerColorHistoryTable } from '@/components/zakazkyMapa/ProjectMarkerColorHistoryTable'
import { ProjectStavbyvedouciSection } from '@/components/zakazkyMapa/ProjectStavbyvedouciSection'
import { fetchProjectMapMarkerByProjectId } from '@/lib/zakazkyMapa/api'
import {
  fetchJobOrderDetail,
  uploadJobOrderDocument,
  deleteJobOrderDocument,
  uploadJobOrderPhoto,
  deleteJobOrderPhoto,
  downloadOrderDocument,
  openOrderDocument,
  getOrderPhotoUrl,
} from '@/lib/orders/api'
import type { JobOrderDetail } from '@/types/orders'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'
import { JOB_ORDER_STATUS_LABELS } from '@/constants/orders'
import { getOrderStatusBadgeVariant } from '@/constants/orderStatusBadge'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const canManageAssignments = profile ? canManageProjectAssignments(profile.role) : false
  const isSiteManager = profile ? isStavbyvedouci(profile.role) : false
  const backPath = isSiteManager ? '/stavbyvedouci/zakazky' : '/zakazky'
  const [detail, setDetail] = useState<JobOrderDetail | null>(null)
  const [marker, setMarker] = useState<ProjectMapMarkerWithOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')
    try {
      const [orderDetail, markerDetail] = await Promise.all([
        fetchJobOrderDetail(id),
        fetchProjectMapMarkerByProjectId(id),
      ])
      setDetail(orderDetail)
      setMarker(markerDetail)
    } catch (err) {
      setDetail(null)
      setMarker(null)
      setLoadError(err instanceof Error ? err.message : 'Zakázka nenalezena')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [id, load])

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !user || !e.target.files?.[0]) return
    const title = prompt('Název dokumentu:', e.target.files[0].name) ?? e.target.files[0].name
    await uploadJobOrderDocument(id, title, e.target.files[0], user.id)
    await load()
    e.target.value = ''
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !user || !e.target.files?.[0]) return
    await uploadJobOrderPhoto(id, e.target.files[0], user.id)
    await load()
    e.target.value = ''
  }

  async function handleOpenDocument(filePath: string) {
    await openOrderDocument(filePath)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  if (!detail) {
    return (
      <AppLayout>
        <Button variant="ghost" className="mb-4" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Button>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-theme-primary">Zakázka nenalezena</p>
          <p className="mt-2 text-sm text-theme-secondary">{loadError || 'Požadovaná zakázka neexistuje nebo byla smazána.'}</p>
        </div>
      </AppLayout>
    )
  }

  const { order } = detail

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4" onClick={() => navigate(backPath)}>
        <ArrowLeft className="h-4 w-4" />
        Zpět na zakázky
      </Button>

      <PageHeader
        title={order.name}
        description={order.location}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {marker ? (
              <MarkerColorBadge color={marker.marker_color} label={marker.color_label} />
            ) : null}
            <StatusBadge
              label={JOB_ORDER_STATUS_LABELS[order.status]}
              variant={getOrderStatusBadgeVariant(order.status)}
            />
          </div>
        }
      />

      <div className="grid gap-6">
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Popis prací" value={order.work_description} className="sm:col-span-2 lg:col-span-3" />
          <Meta label="Období" value={`${formatDate(order.start_date)} – ${formatDate(order.end_date)}`} />
          <Meta label="Číslo zakázky" value={order.order_number || '—'} />
          <Meta label="Investor" value={order.investor || '—'} />
          <Meta label="Objednatel" value={order.client_name || '—'} />
          <Meta label="Kontakt" value={order.contact_person || '—'} />
          <Meta label="Telefon" value={order.phone || '—'} />
          <Meta label="E-mail" value={order.email || '—'} />
          {order.gps_lat != null && order.gps_lng != null && (
            <Meta label="GPS" value={`${order.gps_lat.toFixed(5)}, ${order.gps_lng.toFixed(5)}`} />
          )}
          {order.note && <Meta label="Poznámka" value={order.note} className="sm:col-span-2 lg:col-span-3" />}
        </Card>

        <Section title="Historie změn barvy">
          {id && !isSiteManager ? <ProjectMarkerColorHistoryTable projectId={id} /> : null}
        </Section>

        {canManageAssignments && id && user ? (
          <Section title="Stavbyvedoucí">
            <ProjectStavbyvedouciSection projectId={id} userId={user.id} />
          </Section>
        ) : null}

        <Section title="Zaměstnanci na zakázce">
          <DataTable columns={[{ key: 'name', label: 'Jméno' }, { key: 'position', label: 'Pozice' }]} isEmpty={detail.employees.length === 0} emptyMessage="Zatím žádní zaměstnanci.">
            {detail.employees.map((e) => (
              <DataTableRow key={e.id}>
                <DataTableCell>{e.last_name} {e.first_name}</DataTableCell>
                <DataTableCell>{e.position}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </Section>

        <Section title="Docházka zaměstnanců">
          <DataTable
            columns={[
              { key: 'date', label: 'Datum' },
              { key: 'hours', label: 'Hodiny' },
              { key: 'start', label: 'Začátek' },
              { key: 'end', label: 'Konec' },
            ]}
            isEmpty={detail.attendance.length === 0}
            emptyMessage="Zatím žádná docházka."
          >
            {detail.attendance.map((a) => (
              <DataTableRow key={a.id}>
                <DataTableCell>{formatDate(a.attendance_date)}</DataTableCell>
                <DataTableCell>{a.hours} h</DataTableCell>
                <DataTableCell>{a.work_start ? formatTimeForInput(a.work_start) : '—'}</DataTableCell>
                <DataTableCell>{a.work_end ? formatTimeForInput(a.work_end) : '—'}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </Section>

        {!isSiteManager ? (
          <Section title="Denní výkazy">
            <DataTable
              columns={[
                { key: 'date', label: 'Datum' },
                { key: 'earnings', label: 'Výdělek' },
                { key: 'advance', label: 'Záloha' },
                { key: 'status', label: 'Stav' },
              ]}
              isEmpty={detail.reports.length === 0}
              emptyMessage="Zatím žádné výkazy."
            >
              {detail.reports.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>{formatDate(r.report_date)}</DataTableCell>
                  <DataTableCell>{formatCurrency(r.earnings)}</DataTableCell>
                  <DataTableCell>{formatCurrency(r.advance ?? 0)}</DataTableCell>
                  <DataTableCell>{WORKER_REPORT_STATUS_LABELS[r.status]}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          </Section>
        ) : null}

        {!isSiteManager ? (
          <Section title="Vyplacené zálohy">
            <DataTable
              columns={[
                { key: 'date', label: 'Datum' },
                { key: 'worker', label: 'Zaměstnanec' },
                { key: 'advance', label: 'Záloha' },
                { key: 'earnings', label: 'Výdělek' },
              ]}
              isEmpty={detail.advances.length === 0}
              emptyMessage="Zatím žádné zálohy."
            >
              {detail.advances.map((a, index) => (
                <DataTableRow key={`${a.form_date}-${a.worker_id}-${index}`}>
                  <DataTableCell>{formatDate(a.form_date)}</DataTableCell>
                  <DataTableCell>{a.worker_name}</DataTableCell>
                  <DataTableCell>{formatCurrency(a.advance)}</DataTableCell>
                  <DataTableCell>{formatCurrency(a.earnings)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          </Section>
        ) : null}

        <Section title="Fotografie">
          {isAdmin && (
            <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-4 py-2 text-sm">
              <Upload className="h-4 w-4" />
              Nahrát fotografii
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          )}
          {detail.photos.length === 0 ? (
            <p className="text-sm text-theme-muted">Žádné fotografie.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detail.photos.map((photo) => (
                <div key={photo.id} className="neon-border rounded-xl p-2">
                  <img src={getOrderPhotoUrl(photo.file_path)} alt={photo.file_name} className="max-h-48 w-full rounded-lg object-cover" />
                  {isAdmin && (
                    <Button variant="danger" size="sm" className="mt-2" onClick={() => deleteJobOrderPhoto(photo).then(load)}>
                      <Trash2 className="h-4 w-4" />
                      Smazat
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Dokumenty PDF">
          {isAdmin && (
            <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-4 py-2 text-sm">
              <Upload className="h-4 w-4" />
              Nahrát PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={handleDocUpload} />
            </label>
          )}
          {detail.documents.length === 0 ? (
            <p className="text-sm text-theme-muted">Žádné dokumenty.</p>
          ) : (
            <div className="space-y-2">
              {detail.documents.map((doc) => (
                <div key={doc.id} className="neon-border flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium text-theme-primary">{doc.title}</p>
                      <p className="text-xs text-theme-muted">{doc.file_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleOpenDocument(doc.file_path)}>
                      <ExternalLink className="h-4 w-4" />
                      Otevřít
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => downloadOrderDocument(doc.file_path, doc.file_name)}>
                      <Download className="h-4 w-4" />
                      Stáhnout
                    </Button>
                    {isAdmin && (
                      <Button variant="danger" size="sm" onClick={() => deleteJobOrderDocument(doc).then(load)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-theme-primary">{title}</h3>
      {children}
    </Card>
  )
}

function Meta({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}
