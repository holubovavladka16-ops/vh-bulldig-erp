import { useEffect, useState } from 'react'
import {
  Download,
  ExternalLink,
  FileText,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FotoLokalizacniMapy } from '@/components/fotodokumentace/FotoLokalizacniMapy'
import { FotoPredPoPanel } from '@/components/fotodokumentace/FotoPredPoPanel'
import { FotoSchvaleniAkce } from '@/components/fotodokumentace/FotoSchvaleniAkce'
import { FotoShareButtons } from '@/components/fotodokumentace/FotoShareButtons'
import {
  FOTO_APPROVAL_LABELS,
  FOTO_GPS_STATUS_LABELS,
  VYCHOZI_TYPY_FOTOGRAFII,
  getTypFotografieLabel,
} from '@/constants/fotodokumentace'
import { formatDate, formatTime } from '@/constants/workers'
import {
  fetchFotoAudit,
  getFotoUrl,
  obnovitFotodokument,
  schvalitFotodokument,
  smazatFotodokument,
  upravitFotodokument,
} from '@/lib/fotodokumentace/api'
import { vytvoritFotodokumentPdf, getFotoReportPdfFileName } from '@/lib/fotodokumentace/pdf'
import { stahnoutFotografii } from '@/lib/fotodokumentace/share'
import { getMapyCzUrl } from '@/lib/photos/mapLinks'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoApprovalStatus, FotoAuditEntry, FotoDokument } from '@/types/fotodokumentace'

interface FotoDetailModalProps {
  foto: FotoDokument | null
  onClose: () => void
  onUpdated: () => void
}

export function FotoDetailModal({ foto, onClose, onUpdated }: FotoDetailModalProps) {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [editMode, setEditMode] = useState(false)
  const [note, setNote] = useState('')
  const [photoType, setPhotoType] = useState('')
  const [audit, setAudit] = useState<FotoAuditEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!foto) return
    setNote(foto.note ?? '')
    setPhotoType(foto.photo_type ?? '')
    setEditMode(false)
    setMessage('')
    void fetchFotoAudit(foto.id).then(setAudit)
  }, [foto])

  if (!foto) return null

  const currentFoto = foto
  const imgUrl = getFotoUrl(currentFoto.file_path)
  const isDeleted = Boolean(currentFoto.deleted_at)

  async function handleSaveEdit() {
    if (!user) return
    setBusy(true)
    try {
      await upravitFotodokument(currentFoto.id, { note, photo_type: photoType || null }, user.id)
      setEditMode(false)
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function handleApproval(status: FotoApprovalStatus, reason?: string) {
    if (!user) return
    setBusy(true)
    try {
      await schvalitFotodokument(currentFoto.id, status, user.id, reason)
      onUpdated()
      setMessage(`Stav změněn: ${FOTO_APPROVAL_LABELS[status]}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!user) return
    const reason = prompt('Důvod smazání (volitelné):') ?? undefined
    if (!confirm('Přesunout fotografii do koše?')) return
    setBusy(true)
    try {
      await smazatFotodokument(currentFoto.id, user.id, reason)
      onClose()
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    if (!user) return
    setBusy(true)
    try {
      await obnovitFotodokument(currentFoto.id, user.id)
      onUpdated()
      setMessage('Fotografie obnovena z koše.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePdf() {
    const blob = await vytvoritFotodokumentPdf([currentFoto], company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = getFotoReportPdfFileName(currentFoto)
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="glass-panel max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-glass)] p-4">
          <h2 className="text-lg font-semibold text-theme-primary">
            Detail fotografie {isDeleted && <span className="text-red-400">(koš)</span>}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <img src={imgUrl} alt="" className="max-h-[50vh] w-full rounded-xl object-contain" />

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Meta label="Zakázka" value={foto.order_name ?? '—'} />
            <Meta label="Datum" value={`${formatDate(foto.captured_date)} · ${formatTime(foto.captured_time)}`} />
            <Meta label="Autor" value={foto.creator_name ?? foto.worker_name ?? '—'} />
            <Meta label="Typ" value={getTypFotografieLabel(foto.photo_type)} />
            <Meta label="GPS stav" value={FOTO_GPS_STATUS_LABELS[foto.gps_status]} />
            <Meta label="Schválení" value={FOTO_APPROVAL_LABELS[foto.approval_status]} />
            {foto.gps_lat != null && foto.gps_lng != null && (
              <Meta label="GPS" value={`${foto.gps_lat.toFixed(6)}, ${foto.gps_lng.toFixed(6)}`} />
            )}
            <Meta label="Adresa" value={foto.address_full || '—'} />
          </div>

          {foto.gps_lat != null && foto.gps_lng != null && (
            <FotoLokalizacniMapy
              lat={foto.gps_lat}
              lng={foto.gps_lng}
              accuracy={foto.gps_accuracy}
              address={foto.address_full}
              mapHeight={200}
            />
          )}

          {!isDeleted && user && (
            <FotoPredPoPanel foto={currentFoto} userId={user.id} onUpdated={onUpdated} />
          )}

          {editMode ? (
            <div className="space-y-3">
              <Select
                label="Typ fotografie"
                value={photoType}
                onChange={(e) => setPhotoType(e.target.value)}
                options={[
                  { value: '', label: '—' },
                  ...VYCHOZI_TYPY_FOTOGRAFII.map((t) => ({ value: t.code, label: t.label })),
                ]}
              />
              <Textarea label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <Button variant="primary" onClick={handleSaveEdit} disabled={busy}>Uložit úpravy</Button>
            </div>
          ) : (
            foto.note && <p className="text-sm text-theme-secondary"><strong>Poznámka:</strong> {foto.note}</p>
          )}

          {!isDeleted && user && (
            <FotoSchvaleniAkce foto={currentFoto} busy={busy} onAction={handleApproval} />
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-theme-muted">Sdílení</p>
            <FotoShareButtons foto={currentFoto} onMessage={setMessage} />
          </div>

          <div className="sticky bottom-0 -mx-4 border-t border-[var(--border-glass)] bg-[var(--bg-glass)] p-4 backdrop-blur-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-theme-muted">Akce</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {!isDeleted && (
                <Button variant="secondary" size="sm" className="justify-center" onClick={() => setEditMode((v) => !v)}>
                  Upravit
                </Button>
              )}
              <Button variant="secondary" size="sm" className="justify-center" onClick={() => stahnoutFotografii(currentFoto)}>
                <Download className="h-4 w-4" />Stáhnout
              </Button>
              <Button variant="secondary" size="sm" className="justify-center" onClick={handlePdf}>
                <FileText className="h-4 w-4" />PDF A4
              </Button>
              {currentFoto.gps_lat != null && currentFoto.gps_lng != null && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center"
                  onClick={() => window.open(getMapyCzUrl(currentFoto.gps_lat!, currentFoto.gps_lng!), '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />Mapy.cz
                </Button>
              )}
              {isDeleted ? (
                <Button variant="primary" size="sm" className="justify-center" onClick={handleRestore} disabled={busy}>
                  <RotateCcw className="h-4 w-4" />Obnovit z koše
                </Button>
              ) : (
                <Button variant="danger" size="sm" className="justify-center" onClick={handleDelete} disabled={busy}>
                  <Trash2 className="h-4 w-4" />Do koše
                </Button>
              )}
            </div>
            {message && <p className="mt-2 text-sm text-theme-muted">{message}</p>}
          </div>

          {audit.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-theme-primary">Historie</h3>
              <ul className="space-y-1 text-xs text-theme-muted">
                {audit.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    {new Date(a.created_at).toLocaleString('cs-CZ')} · {a.action}
                    {a.performer_name ? ` · ${a.performer_name}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-theme-primary">{value}</p>
    </div>
  )
}
