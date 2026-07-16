import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Droplets, Eye, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WatermarkRangeSlider } from '@/components/settings/WatermarkRangeSlider'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { uploadCompanyWatermark } from '@/lib/company/api'
import { buildProfessionalReportDocument } from '@/lib/print/printDocument'
import {
  buildWatermarkPreviewSampleBody,
  DEFAULT_WATERMARK_BLUR_PX,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_SIZE_PERCENT,
  WATERMARK_SIZE_PERCENT_MAX,
  WATERMARK_SIZE_PERCENT_MIN,
} from '@/lib/print/watermark'
import type { CompanySettings } from '@/types'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']

function validateWatermarkFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Povolené formáty: PNG, JPG nebo SVG.'
  }
  if (file.size > 8 * 1024 * 1024) {
    return 'Soubor je příliš velký (max. 8 MB).'
  }
  return null
}

function normalizeWatermarkForm(settings: CompanySettings): CompanySettings {
  return {
    ...settings,
    watermark_opacity: Number(settings.watermark_opacity ?? DEFAULT_WATERMARK_OPACITY),
    watermark_size_mm: Number(settings.watermark_size_mm ?? DEFAULT_WATERMARK_SIZE_PERCENT),
    watermark_blur_px: Number(settings.watermark_blur_px ?? DEFAULT_WATERMARK_BLUR_PX),
  }
}

export function PdfWatermarkSettingsPage() {
  const { settings, loading, saveSettings, refreshProfile } = useCompanySettings()
  const [form, setForm] = useState<CompanySettings | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const localPreviewRef = useRef<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!settings || initialized) return
    const normalized = normalizeWatermarkForm(settings)
    setForm(normalized)
    setPreviewImageUrl(normalized.watermark_url ?? '')
    setInitialized(true)
  }, [settings, initialized])

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current)
        localPreviewRef.current = null
      }
    }
  }, [])

  const previewCompany = useMemo(() => {
    if (!form) return null
    return {
      ...form,
      watermark_url: previewImageUrl || form.watermark_url || '',
    }
  }, [form, previewImageUrl])

  const previewHtml = useMemo(() => {
    if (!previewCompany) return ''
    return buildProfessionalReportDocument(
      {
        title: 'Náhled PDF vodoznaku',
        documentNumber: 'NAHLED-001',
        createdAt: new Date().toLocaleString('cs-CZ'),
      },
      buildWatermarkPreviewSampleBody(),
      previewCompany
    )
  }, [previewCompany])

  const previewKey = previewCompany
    ? `${previewCompany.watermark_url}|${previewCompany.watermark_opacity}|${previewCompany.watermark_size_mm}|${previewCompany.watermark_blur_px}`
    : 'empty'

  const updateField = useCallback(<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setMessage('')
  }, [])

  function setLocalPreviewUrl(blobUrl: string) {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current)
    }
    localPreviewRef.current = blobUrl
    setPreviewImageUrl(blobUrl)
  }

  function handleFileSelect(file: File) {
    if (!form) return
    const validation = validateWatermarkFile(file)
    if (validation) {
      setError(validation)
      return
    }

    setError('')
    setMessage('')

    const blobUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(blobUrl)
    setForm((prev) => (prev ? { ...prev, watermark_url: blobUrl } : prev))

    void handleUpload(file)
  }

  async function handleUpload(file: File) {
    if (!form) return

    setUploading(true)
    try {
      const url = await uploadCompanyWatermark(form.id, file)
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current)
        localPreviewRef.current = null
      }
      setPreviewImageUrl(url)
      setForm((prev) => (prev ? { ...prev, watermark_url: url } : prev))
      setMessage('Vodoznak byl nahrán. Uložte nastavení nebo upravte parametry a potvrďte tlačítkem Uložit.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání vodoznaku se nezdařilo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveSettings() {
    if (!form) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = normalizeWatermarkForm({
        ...form,
        watermark_url: previewImageUrl || form.watermark_url || '',
      })
      await saveSettings(payload)
      await refreshProfile()
      setForm(payload)
      setPreviewImageUrl(payload.watermark_url ?? '')
      setMessage('Nastavení vodoznaku bylo uloženo a použije se pro všechna nová PDF.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  function handleResetDefaults() {
    if (!form) return
    setForm((prev) =>
      prev
        ? {
            ...prev,
            watermark_opacity: DEFAULT_WATERMARK_OPACITY,
            watermark_size_mm: DEFAULT_WATERMARK_SIZE_PERCENT,
            watermark_blur_px: DEFAULT_WATERMARK_BLUR_PX,
          }
        : prev
    )
    setMessage('')
    setError('')
  }

  async function handleRemoveWatermark() {
    if (!form) return
    if (!confirm('Odebrat vodoznak ze všech PDF exportů?')) return

    setSaving(true)
    setError('')
    try {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current)
        localPreviewRef.current = null
      }
      const next = { ...form, watermark_url: '' }
      setPreviewImageUrl('')
      setForm(next)
      await saveSettings(next)
      await refreshProfile()
      setMessage('Vodoznak byl odstraněn.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odstranění vodoznaku se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <AppLayout title="Vodoznak PDF">
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  const thumbnailUrl = previewImageUrl || form.watermark_url || ''
  const opacity = Number(form.watermark_opacity ?? DEFAULT_WATERMARK_OPACITY)
  const sizePercent = Number(form.watermark_size_mm ?? DEFAULT_WATERMARK_SIZE_PERCENT)
  const blurPx = Number(form.watermark_blur_px ?? DEFAULT_WATERMARK_BLUR_PX)

  return (
    <AppLayout title="Vodoznak PDF">
      <PageHeader
        title="Vodoznak PDF"
        description="Nahrajte vlastní obrázek a nastavte jeho vzhled. Použije se automaticky ve všech PDF exportech."
      />

      <div className="mb-4">
        <Link to="/nastaveni" className="text-sm text-theme-muted hover:text-theme-primary">
          ← Zpět do nastavení
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="relative z-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-3 nav-item-active">
              <Droplets className="h-6 w-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-semibold text-theme-primary">Nahrát vodoznak</h3>
              <p className="text-sm text-theme-muted">PNG, JPG nebo SVG z počítače nebo mobilu.</p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Aktuální vodoznak"
                className="max-h-28 max-w-[220px] rounded-lg border border-[var(--border-glass)] bg-white p-2"
                style={{ opacity: opacity / 100, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
              />
            ) : (
              <div className="flex h-28 w-52 items-center justify-center rounded-lg border border-dashed border-[var(--border-glass)] bg-white/5 text-xs text-theme-muted">
                Vodoznak není nahrán
              </div>
            )}

            <label className="cursor-pointer">
              <span className="btn-neon inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm">
                <Upload className="h-4 w-4" />
                {uploading ? 'Nahrávám…' : 'Nahrát vodoznak'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="relative z-20 space-y-4 border-t border-[var(--border-glass)] pt-4">
            <WatermarkRangeSlider
              label="Průhlednost"
              min={0}
              max={100}
              value={opacity}
              formatValue={(v) => `${v} %`}
              onChange={(v) => updateField('watermark_opacity', v)}
            />

            <WatermarkRangeSlider
              label="Velikost"
              min={WATERMARK_SIZE_PERCENT_MIN}
              max={WATERMARK_SIZE_PERCENT_MAX}
              value={sizePercent}
              formatValue={(v) => `${v} % šířky stránky`}
              onChange={(v) => updateField('watermark_size_mm', v)}
            />

            <WatermarkRangeSlider
              label="Rozostření"
              min={0}
              max={20}
              value={blurPx}
              formatValue={(v) => `${v} px`}
              onChange={(v) => updateField('watermark_blur_px', v)}
            />

            <p className="text-xs text-theme-muted">
              Umístění: přesně uprostřed stránky, pod obsahem (pozadí). Velikost = % šířky A4, poměr stran se zachová.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleSaveSettings()} loading={saving}>
              <Save className="h-4 w-4" />
              Uložit
            </Button>
            <Button type="button" variant="secondary" onClick={handleResetDefaults} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              Obnovit výchozí nastavení
            </Button>
            {thumbnailUrl && (
              <Button type="button" variant="secondary" onClick={() => void handleRemoveWatermark()} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Odstranit vodoznak
              </Button>
            )}
          </div>

          {message && <p className="text-sm text-green-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </Card>

        <Card className="relative z-0">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-[var(--accent-primary)]" />
            <h3 className="font-semibold text-theme-primary">Živý náhled PDF</h3>
          </div>
          <p className="mb-3 text-sm text-theme-muted">
            Náhled se aktualizuje okamžitě při každé změně průhlednosti, velikosti nebo rozostření.
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--border-glass)] bg-white">
            <iframe
              key={previewKey}
              title="Náhled PDF vodoznaku"
              srcDoc={previewHtml}
              className="pointer-events-none h-[min(70vh,720px)] w-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
