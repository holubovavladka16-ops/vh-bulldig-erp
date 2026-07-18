import { useEffect, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import '@/styles/photoMap.css'
import { PostCaptureGpsPanel } from '@/components/photos/PostCaptureGpsPanel'
import { usePostCaptureGps } from '@/hooks/usePostCaptureGps'
import { usePhotoCameraStream } from '@/hooks/usePhotoCameraStream'
import { getDeviceOrientation } from '@/lib/photos/gpsWatch'
import { createGpsPhoto } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'

type CapturePhase = 'camera' | 'save'

interface CapturedSnapshot {
  file: File
  previewUrl: string
  capturedAt: Date
  deviceHeading: number | null
}

export interface PhotoCaptureFlowProps {
  active: boolean
  uploadedBy: string
  creatorName: string
  constructionPointId?: string
  defaultOrderId?: string
  lockOrder?: boolean
  onCreated: () => void
  onCancel?: () => void
  /** Kompaktní režim bez horní navigace (uvnitř modalu). */
  compact?: boolean
}

export function PhotoCaptureFlow({
  active,
  uploadedBy,
  creatorName,
  constructionPointId,
  defaultOrderId,
  lockOrder = false,
  onCreated,
  onCancel,
  compact = false,
}: PhotoCaptureFlowProps) {
  const [phase, setPhase] = useState<CapturePhase>('camera')
  const [snapshot, setSnapshot] = useState<CapturedSnapshot | null>(null)
  const [orderId, setOrderId] = useState('')
  const [note, setNote] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const camera = usePhotoCameraStream({ enabled: active && phase === 'camera' })
  const postGps = usePostCaptureGps(active && phase === 'save' && snapshot != null)

  const canCapture = !saving

  useEffect(() => {
    if (!active) return
    setPhase('camera')
    setSnapshot(null)
    setNote('')
    setOrderId(defaultOrderId ?? '')
    setError('')
    setSaving(false)

    fetchJobOrders().then((orders) => {
      setOrderOptions([
        { value: '', label: '— Vyberte zakázku —' },
        ...orders.map((o) => ({ value: o.id, label: o.name })),
      ])
    })
  }, [active, defaultOrderId])

  useEffect(() => {
    return () => {
      if (snapshot?.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
    }
  }, [snapshot?.previewUrl])

  if (!active) return null

  function takeSnapshot(file: File) {
    const previewUrl = URL.createObjectURL(file)

    setSnapshot({
      file,
      previewUrl,
      capturedAt: new Date(),
      deviceHeading: getDeviceOrientation(),
    })
    setPhase('save')
    setError('')
    camera.stop()
  }

  async function handleCameraCapture() {
    if (!camera.isActive || saving) return
    const file = await camera.captureFrame()
    if (!file) {
      setError('Snímek se nepodařilo pořídit. Zkuste znovu nebo použijte Galerie.')
      return
    }
    takeSnapshot(file)
  }

  function handleGalleryInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) takeSnapshot(selected)
  }

  function handleRetake() {
    if (snapshot?.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
    setSnapshot(null)
    setPhase('camera')
    setError('')
    camera.stop()
  }

  async function handleSave() {
    if (!snapshot || !postGps.position || !postGps.address) return
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }
    if (!postGps.canSave) {
      setError('Počkejte na přesnější polohu (ideálně do ±10 m) před uložením.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await createGpsPhoto(
        {
          file: snapshot.file,
          captured_at: snapshot.capturedAt,
          gps_lat: postGps.position.lat,
          gps_lng: postGps.position.lng,
          gps_accuracy: postGps.position.accuracy,
          device_heading: snapshot.deviceHeading,
          ...postGps.address,
          note,
          order_id: orderId,
          construction_point_id: constructionPointId ?? null,
        },
        uploadedBy
      )
      if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
      setSnapshot(null)
      setPhase('camera')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'camera') {
    return (
      <div className={`photo-capture-flow ${compact ? '' : 'photo-capture-flow--page'}`}>
        {!compact && onCancel && (
          <div className="mb-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
              Galerie
            </Button>
            <p className="text-sm text-theme-muted">GPS a adresa se načtou po vyfocení</p>
          </div>
        )}

        <div className="photo-camera-shell">
          <div className="photo-camera-viewport">
            <video
              ref={camera.videoRef}
              className="photo-camera-video"
              playsInline
              muted
              autoPlay
            />

            {!camera.isActive && camera.phase === 'starting' && (
              <div className="photo-camera-placeholder">
                <Loader2 className="h-10 w-10 animate-spin text-white/60" />
                <p className="mt-3 text-sm text-white/70">Spouštím fotoaparát…</p>
              </div>
            )}

            {!camera.isActive && camera.phase !== 'starting' && camera.error && (
              <div className="photo-camera-placeholder">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="mt-3 text-sm text-red-300">{camera.error}</p>
              </div>
            )}

            {!camera.isActive && camera.phase !== 'starting' && !camera.error && (
              <div className="photo-camera-placeholder">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="mt-3 text-sm text-white/70">
                  Fotoaparát se spustí po udělení oprávnění.
                </p>
              </div>
            )}
          </div>

          <div className="photo-camera-actions">
            <button
              type="button"
              className={`photo-capture-btn photo-capture-btn--primary ${!canCapture || !camera.isActive ? 'photo-capture-btn--disabled' : ''}`}
              disabled={!canCapture || !camera.isActive}
              onClick={() => void handleCameraCapture()}
            >
              <Camera className="h-6 w-6" />
              Vyfotit
            </button>

            <label className="photo-capture-btn photo-capture-btn--secondary">
              <ImagePlus className="h-5 w-5" />
              Galerie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={saving}
                onChange={handleGalleryInput}
              />
            </label>

            {!camera.isActive && camera.phase !== 'starting' && (
              <label className="photo-capture-btn photo-capture-btn--secondary">
                <Camera className="h-5 w-5" />
                Fotoaparát (záložní)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={saving}
                  onChange={handleGalleryInput}
                />
              </label>
            )}
          </div>

          {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  if (!snapshot) return null

  const dateStr = snapshot.capturedAt.toLocaleDateString('cs-CZ')
  const timeStr = snapshot.capturedAt.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={`photo-capture-flow ${compact ? '' : 'photo-capture-flow--page'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-theme-primary">Uložit fotografii</h2>
        <Button type="button" variant="secondary" size="sm" onClick={handleRetake} disabled={saving}>
          <Camera className="h-4 w-4" />
          Vyfotit znovu
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-black/40">
          <img
            src={snapshot.previewUrl}
            alt="Pořízená fotografie"
            className="max-h-[360px] w-full object-contain"
          />
        </div>

        <div className="space-y-4">
          <Select
            label="Zakázka"
            options={orderOptions}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={saving || lockOrder}
          />

          <Textarea
            label="Poznámka"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Popis provedených prací…"
            rows={3}
            disabled={saving}
          />

          <div className="rounded-xl border border-[var(--border-glass)] bg-white/5 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-theme-muted">
              Automaticky doplněno
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" />
                <div>
                  <dt className="text-xs text-theme-muted">Pořídil</dt>
                  <dd className="text-theme-primary">{creatorName}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">Datum a čas</dt>
                <dd className="text-theme-primary">
                  {dateStr} · {timeStr}
                </dd>
              </div>
            </dl>
          </div>

          <PostCaptureGpsPanel
            phase={postGps.phase}
            statusLabel={postGps.statusLabel}
            position={postGps.position}
            address={postGps.address}
            addressLoading={postGps.addressLoading}
            error={postGps.error}
            isImprecise={postGps.isImprecise}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          {!postGps.canSave && postGps.isImprecise && (
            <p className="text-sm text-amber-300">
              Uložení bude možné po dosažení přesnosti do ±10 m. GPS se nadále upřesňuje.
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            loading={saving}
            disabled={!postGps.canSave || saving}
            onClick={() => void handleSave()}
          >
            <Check className="h-4 w-4" />
            Uložit fotografii
          </Button>

          {saving && (
            <p className="flex items-center justify-center gap-2 text-sm text-theme-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám do galerie, mapy a stavebního bodu…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
