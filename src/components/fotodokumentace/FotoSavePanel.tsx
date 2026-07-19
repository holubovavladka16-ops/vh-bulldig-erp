import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FotoGpsPanel } from '@/components/fotodokumentace/FotoGpsPanel'
import { VYCHOZI_TYPY_FOTOGRAFII } from '@/constants/fotodokumentace'
import { usePostCaptureLocation } from '@/hooks/fotodokumentace/usePostCaptureLocation'
import { ulozitFotodokument } from '@/lib/fotodokumentace/api'
import { vytvoritMiniaturu } from '@/lib/fotodokumentace/geolocation'
import { ulozitDoOfflineFronty } from '@/lib/fotodokumentace/offlineQueue'
import { vytvoritVodotisk } from '@/lib/fotodokumentace/watermark'
import { fetchJobOrders } from '@/lib/orders/api'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoCaptureResult } from '@/components/fotodokumentace/FotoCaptureScreen'
import type { FotoGpsStatus } from '@/types/fotodokumentace'

interface FotoSavePanelProps {
  capture: FotoCaptureResult
  uploadedBy: string
  creatorName: string
  defaultOrderId?: string
  lockOrder?: boolean
  onSaved: () => void
  onCancel: () => void
}

const POVOLENE_ZAKAZKY = ['aktivni', 'pripravuje_se', 'pozastavena'] as const

export function FotoSavePanel({
  capture,
  uploadedBy,
  creatorName,
  defaultOrderId,
  lockOrder = false,
  onSaved,
  onCancel,
}: FotoSavePanelProps) {
  const { settings: company } = useCompanySettings()
  const gps = usePostCaptureLocation(true)
  const [orderId, setOrderId] = useState(defaultOrderId ?? '')
  const [photoType, setPhotoType] = useState('')
  const [note, setNote] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchJobOrders().then((orders) => {
      let eligible = orders.filter((o) =>
        (POVOLENE_ZAKAZKY as readonly string[]).includes(o.status)
      )
      if (eligible.length === 0) {
        eligible = orders.filter((o) => o.status !== 'archivovana')
      }
      setOrderOptions([
        { value: '', label: '— Vyberte zakázku —' },
        ...eligible.map((o) => ({ value: o.id, label: o.name })),
      ])
      if (defaultOrderId) setOrderId(defaultOrderId)
      else if (eligible.length === 1) setOrderId(eligible[0].id)
    })
  }, [defaultOrderId])

  async function handleSave() {
    if (!orderId) {
      setError('Vyberte zakázku – bez zakázky nelze fotografii uložit.')
      return
    }

    if (gps.faze === 'loading') {
      setError('Počkejte na načtení GPS polohy, nebo zvolte „Uložit bez GPS“.')
      return
    }

    if (gps.faze === 'low_accuracy') {
      setError('Potvrďte polohu tlačítkem „Použít tuto polohu“, nebo zkuste přesnější GPS.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    const adresa = gps.resolveAdresa()
    const gpsStatus = (gps.gpsStatus as FotoGpsStatus) || 'missing'
    const orderName = orderOptions.find((o) => o.value === orderId)?.label ?? 'zakazka'

    try {
      const thumbnail = await vytvoritMiniaturu(capture.file)
      const watermarked = company?.watermark_url
        ? await vytvoritVodotisk({
            file: capture.file,
            company,
            foto: {
              captured_at: capture.capturedAt.toISOString(),
              gps_lat: gps.poloha?.lat ?? null,
              gps_lng: gps.poloha?.lng ?? null,
              address_full: adresa.address_full,
              order_name: orderName,
              creator_name: creatorName,
            },
          })
        : null

      const payload = {
        file: capture.file,
        thumbnail: thumbnail ?? undefined,
        watermarked: watermarked ?? undefined,
        captured_at: capture.capturedAt,
        gps_lat: gps.poloha?.lat ?? null,
        gps_lng: gps.poloha?.lng ?? null,
        gps_accuracy: gps.poloha?.accuracy ?? gps.accuracy,
        gps_status: gpsStatus,
        address: adresa,
        note,
        photo_type: photoType || null,
        order_id: orderId,
      }

      if (!navigator.onLine) {
        await ulozitDoOfflineFronty(payload, uploadedBy)
      } else {
        await ulozitFotodokument(payload, uploadedBy, orderName)
      }

      setSuccess(true)
      setTimeout(onSaved, 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled =
    saving || gps.faze === 'loading' || success

  return (
    <div className="space-y-4">
      <img
        src={capture.previewUrl}
        alt="Náhled"
        className="max-h-40 w-full rounded-xl object-cover"
      />

      <FotoGpsPanel
        faze={gps.faze}
        poloha={gps.poloha}
        adresa={gps.adresa}
        accuracy={gps.accuracy}
        chyba={gps.chyba}
        manualAdresa={gps.manualAdresa}
        targetMeters={gps.targetMeters}
        onManualChange={gps.setManualAddress}
        onRetry={gps.retry}
        onSaveWithoutGps={gps.saveWithoutGps}
        onAcceptLowAccuracy={gps.acceptLowAccuracy}
        gpsStatus={gps.gpsStatus}
      />

      <Select
        label="Zakázka"
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        options={orderOptions}
        disabled={lockOrder}
        required
      />

      <Select
        label="Typ fotografie"
        value={photoType}
        onChange={(e) => setPhotoType(e.target.value)}
        options={[
          { value: '', label: '— Vyberte typ —' },
          ...VYCHOZI_TYPY_FOTOGRAFII.map((t) => ({ value: t.code, label: t.label })),
        ]}
      />

      <Textarea
        label="Poznámka"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Krátká poznámka k fotografii…"
        rows={3}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && (
        <p className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" />
          Fotografie uložena – otevírám galerii…
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
          Zrušit
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSave} disabled={saveDisabled}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Uložit fotografii
        </Button>
      </div>
    </div>
  )
}
