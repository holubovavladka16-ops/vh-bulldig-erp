import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
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
  schvalitFotodokument,
  smazatFotodokument,
  upravitFotodokument,
} from '@/lib/fotodokumentace/api'
import { vytvoritFotodokumentPdf } from '@/lib/fotodokumentace/pdf'
import { sdiletFotografii, stahnoutFotografii } from '@/lib/fotodokumentace/share'
import { getMapyCzUrl } from '@/lib/photos/mapLinks'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoAuditEntry, FotoDokument } from '@/types/fotodokumentace'

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

  async function handleApprove(status: 'schvalena' | 'zamitnuta' | 'ke_kontrole') {
    if (!user) return
    const reason = status === 'zamitnuta' ? prompt('Důvod zamítnutí:') ?? undefined : undefined
    setBusy(true)
    try {
      await schvalitFotodokument(currentFoto.id, status, user.id, reason)
      onUpdated()
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

  async function handlePdf() {
    const blob = await vytvoritFotodokumentPdf([currentFoto], company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fotodokumentace_${currentFoto.file_name.replace(/\.[^.]+$/, '')}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleShare() {
    const ok = await sdiletFotografii(currentFoto)
    setMessage(ok ? 'Sdíleno.' : 'Sdílení se nezdařilo.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="glass-panel max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-glass)] p-4">
          <h2 className="text-lg font-semibold text-theme-primary">Detail fotografie</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <img src={imgUrl} alt="" className="w-full rounded-xl object-contain max-h-[50vh]" />

          <div className="grid gap-2 text-sm">
            <p><strong>Zakázka:</strong> {foto.order_name ?? '—'}</p>
            <p><strong>Datum:</strong> {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}</p>
            <p><strong>Autor:</strong> {foto.creator_name ?? '—'}</p>
            <p><strong>Typ:</strong> {getTypFotografieLabel(foto.photo_type)}</p>
            <p><strong>GPS stav:</strong> {FOTO_GPS_STATUS_LABELS[foto.gps_status]}</p>
            <p><strong>Schválení:</strong> {FOTO_APPROVAL_LABELS[foto.approval_status]}</p>
            {foto.gps_lat != null && foto.gps_lng != null && (
              <p><strong>GPS:</strong> {foto.gps_lat.toFixed(6)}, {foto.gps_lng.toFixed(6)}</p>
            )}
            <p><strong>Adresa:</strong> {foto.address_full || '—'}</p>
          </div>

          {foto.gps_lat != null && foto.gps_lng != null && (
            <PhotoMiniMap lat={foto.gps_lat} lng={foto.gps_lng} />
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

          <div className="sticky bottom-0 -mx-4 border-t border-[var(--border-glass)] bg-[var(--bg-glass)] p-4 backdrop-blur-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-theme-muted">Akce</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button variant="secondary" size="sm" className="justify-center" onClick={() => setEditMode((v) => !v)}>
                Upravit
              </Button>
              <Button variant="primary" size="sm" className="justify-center" onClick={handleShare}>
                <Share2 className="h-4 w-4" />Sdílet foto
              </Button>
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
                  <ExternalLink className="h-4 w-4" />Mapa
                </Button>
              )}
              <Button variant="secondary" size="sm" className="justify-center" onClick={() => handleApprove('schvalena')}>
                <Check className="h-4 w-4" />Schválit
              </Button>
              <Button variant="danger" size="sm" className="justify-center" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />Smazat
              </Button>
            </div>
            {message && <p className="mt-2 text-sm text-theme-muted">{message}</p>}
          </div>

          {audit.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-theme-primary">Historie</h3>
              <ul className="space-y-1 text-xs text-theme-muted">
                {audit.slice(0, 8).map((a) => (
                  <li key={a.id}>{new Date(a.created_at).toLocaleString('cs-CZ')} · {a.action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
