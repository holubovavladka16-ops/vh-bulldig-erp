import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Loader2, MapPin, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DiaryWorkersBox } from '@/components/diary/DiaryWorkersBox'
import { DiaryChipSelect } from '@/components/diary/DiaryChipSelect'
import { DiaryPhotoPickerModal } from '@/components/diary/DiaryPhotoPickerModal'
import { DiaryPhotoCard } from '@/components/diary/DiaryPhotoCard'
import { DiaryPhotosMap } from '@/components/diary/DiaryPhotosMap'
import { fetchDiaryDetail } from '@/lib/diary/api'
import { polishDiaryWorkDescription } from '@/lib/diary/aiAssistant'
import { fetchDiaryPrefill } from '@/lib/diary/prefill'
import { todayIsoDate } from '@/lib/dates'
import {
  DIARY_EQUIPMENT_OPTIONS,
  DIARY_MATERIAL_OPTIONS,
  DIARY_WEATHER_OPTIONS,
  formatDiaryWeather,
  joinChipValues,
  parseChipValues,
  type DiaryWeatherType,
} from '@/constants/diary'
import type {
  ConstructionDiaryCreateInput,
  ConstructionDiaryEntry,
  DiaryPrefillData,
} from '@/types/diary'
import type { GpsPhoto } from '@/types/photos'

interface DiaryFormModalProps {
  open: boolean
  initial?: ConstructionDiaryEntry | null
  orderOptions: { value: string; label: string }[]
  onClose: () => void
  onSubmit: (data: ConstructionDiaryCreateInput) => Promise<void>
}

const emptyPrefill: DiaryPrefillData = {
  order_name: '',
  site_location: '',
  workers: [],
  worker_count: 0,
  worker_names: '',
  performances_summary: '',
  material_hints: [],
  photos: [],
}

export function DiaryFormModal({ open, initial, orderOptions, onClose, onSubmit }: DiaryFormModalProps) {
  const [entryDate, setEntryDate] = useState(todayIsoDate())
  const [orderId, setOrderId] = useState('')
  const [weatherType, setWeatherType] = useState<DiaryWeatherType | ''>('')
  const [temperature, setTemperature] = useState('')
  const [equipmentSelected, setEquipmentSelected] = useState<string[]>([])
  const [equipmentCustom, setEquipmentCustom] = useState('')
  const [materialSelected, setMaterialSelected] = useState<string[]>([])
  const [materialCustom, setMaterialCustom] = useState('')
  const [roughWorkDescription, setRoughWorkDescription] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [aiWorkDescription, setAiWorkDescription] = useState('')
  const [aiAssisted, setAiAssisted] = useState(false)
  const [note, setNote] = useState('')
  const [extraordinaryEvents, setExtraordinaryEvents] = useState('')
  const [prefill, setPrefill] = useState<DiaryPrefillData>(emptyPrefill)
  const [linkedPhotoIds, setLinkedPhotoIds] = useState<string[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<GpsPhoto[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPrefill = useCallback(async (oid: string, date: string, keepManual = false) => {
    if (!oid || !date) {
      setPrefill(emptyPrefill)
      setLinkedPhotoIds([])
      return
    }

    setPrefillLoading(true)
    try {
      const data = await fetchDiaryPrefill(oid, date)
      setPrefill(data)
      if (!keepManual) {
        setLinkedPhotoIds([])
        setSelectedPhotos([])
        if (data.material_hints.length > 0) {
          const hints = data.material_hints.flatMap((h) => h.split(/[,;]/).map((x) => x.trim()).filter(Boolean))
          const known = hints.filter((h) => (DIARY_MATERIAL_OPTIONS as readonly string[]).includes(h))
          const custom = hints.filter((h) => !(DIARY_MATERIAL_OPTIONS as readonly string[]).includes(h))
          setMaterialSelected(known)
          setMaterialCustom(custom.join(', '))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení dat se nezdařilo')
      setPrefill(emptyPrefill)
    } finally {
      setPrefillLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    if (initial) {
      setEntryDate(initial.entry_date)
      setOrderId(initial.order_id)
      setWeatherType(initial.weather_type ?? '')
      setTemperature(initial.temperature_celsius != null ? String(initial.temperature_celsius) : '')
      const eq = parseChipValues(initial.equipment, DIARY_EQUIPMENT_OPTIONS)
      setEquipmentSelected(eq.selected)
      setEquipmentCustom(eq.custom)
      const mat = parseChipValues(initial.material, DIARY_MATERIAL_OPTIONS)
      setMaterialSelected(mat.selected)
      setMaterialCustom(mat.custom)
      setRoughWorkDescription(initial.rough_work_description ?? '')
      setWorkDescription(initial.work_description)
      setAiWorkDescription(initial.ai_work_description ?? '')
      setAiAssisted(initial.ai_assisted ?? false)
      setNote(initial.note)
      setExtraordinaryEvents(initial.extraordinary_events)
      setError('')

      fetchDiaryDetail(initial.id)
        .then((detail) => {
          const linked = (detail?.photos ?? []).map((p) => p.id)
          setLinkedPhotoIds(linked)
          setSelectedPhotos(detail?.photos ?? [])
        })
        .catch(() => {
          setLinkedPhotoIds([])
          setSelectedPhotos([])
        })

      void loadPrefill(initial.order_id, initial.entry_date, true)
    } else {
      setEntryDate(todayIsoDate())
      setOrderId('')
      setWeatherType('')
      setTemperature('')
      setEquipmentSelected([])
      setEquipmentCustom('')
      setMaterialSelected([])
      setMaterialCustom('')
      setRoughWorkDescription('')
      setWorkDescription('')
      setAiWorkDescription('')
      setAiAssisted(false)
      setNote('')
      setExtraordinaryEvents('')
      setPrefill(emptyPrefill)
      setLinkedPhotoIds([])
      setSelectedPhotos([])
      setError('')
    }
  }, [open, initial, loadPrefill])

  useEffect(() => {
    if (!open || initial) return
    const timeout = setTimeout(() => {
      void loadPrefill(orderId, entryDate)
    }, 300)
    return () => clearTimeout(timeout)
  }, [open, initial, orderId, entryDate, loadPrefill])

  useEffect(() => {
    if (!open || !initial) return
    const timeout = setTimeout(() => {
      void loadPrefill(orderId, entryDate, true)
    }, 300)
    return () => clearTimeout(timeout)
  }, [open, initial, orderId, entryDate, loadPrefill])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const tempValue = temperature.trim() ? parseFloat(temperature) : null
    if (!entryDate || !orderId || !weatherType || !workDescription.trim()) {
      setError('Vyberte zakázku, datum, počasí a doplňte popis práce.')
      return
    }

    const payload: ConstructionDiaryCreateInput = {
      entry_date: entryDate,
      order_id: orderId,
      weather_type: weatherType,
      temperature_celsius: tempValue != null && !Number.isNaN(tempValue) ? tempValue : null,
      weather: formatDiaryWeather(weatherType, tempValue),
      site_location: prefill.site_location,
      worker_count: prefill.worker_count,
      worker_names: prefill.worker_names,
      equipment: joinChipValues(equipmentSelected, equipmentCustom),
      material: joinChipValues(materialSelected, materialCustom),
      performances_summary: prefill.performances_summary,
      rough_work_description: roughWorkDescription.trim(),
      work_description: workDescription.trim(),
      ai_work_description: aiWorkDescription.trim(),
      ai_assisted: aiAssisted,
      note: note.trim(),
      extraordinary_events: extraordinaryEvents.trim(),
      linked_photo_ids: linkedPhotoIds,
    }

    setLoading(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  async function handleAiPolish() {
    setError('')
    if (!roughWorkDescription.trim()) {
      setError('Nejdříve napište hrubý popis práce.')
      return
    }

    setAiLoading(true)
    try {
      const result = await polishDiaryWorkDescription(roughWorkDescription)
      setAiWorkDescription(result.polished_text)
      setWorkDescription(result.polished_text)
      setAiAssisted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úprava pomocí AI se nezdařila')
    } finally {
      setAiLoading(false)
    }
  }

  const orderSelectOptions = [{ value: '', label: '— Vyberte zakázku —' }, ...orderOptions]
  const materialOptions = [
    ...new Set([
      ...DIARY_MATERIAL_OPTIONS,
      ...prefill.material_hints.filter((h) => !(DIARY_MATERIAL_OPTIONS as readonly string[]).includes(h)),
    ]),
  ]

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">
              {initial ? 'Upravit zápis' : 'Nový zápis stavebního deníku'}
            </h2>
            <p className="mt-1 text-sm text-theme-muted">
              Vyberte zakázku a datum — systém načte dělníky, výkony a fotky. Doplňte počasí, techniku a popis práce.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="space-y-4">
            <h3 className="font-semibold text-theme-primary">Základní výběr</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Zakázka *"
                options={orderSelectOptions}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
              <Input
                label="Datum *"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

            {prefillLoading && (
              <div className="flex items-center gap-2 text-sm text-theme-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítám data z docházky a fotodokumentace…
              </div>
            )}

            {orderId && entryDate && (
              <div className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                <div>
                  <p className="text-xs text-theme-muted">Místo stavby</p>
                  <p className="font-medium text-theme-primary">{prefill.site_location || '—'}</p>
                </div>
              </div>
            )}
          </Card>

          {orderId && entryDate && (
            <>
              <Card className="space-y-4">
                <h3 className="font-semibold text-theme-primary">Automaticky načteno</h3>
                <DiaryWorkersBox workers={prefill.workers} workerCount={prefill.worker_count} loading={prefillLoading} />

                <div>
                  <p className="mb-1 text-sm font-medium text-theme-secondary">Výkony z docházky</p>
                  <p className="text-xs text-theme-muted">Souhrn prací podle individuálního ceníku zaměstnanců</p>
                  <div className="mt-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-3 py-2 text-sm text-theme-primary whitespace-pre-wrap">
                    {prefillLoading
                      ? 'Načítám…'
                      : prefill.performances_summary || 'Pro tento den nejsou evidované výkony.'}
                  </div>
                </div>

                <Card className="space-y-4 border-[var(--accent-primary)]/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-theme-primary">Fotodokumentace</h4>
                      <p className="text-xs text-theme-muted">Pouze z modulu Fotky s GPS — ne z galerie telefonu.</p>
                    </div>
                    <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
                      <ImagePlus className="h-4 w-4" />
                      Přidat fotografie z Fotodokumentace
                    </Button>
                  </div>

                  {selectedPhotos.length === 0 ? (
                    <p className="text-sm text-theme-muted">Zatím nejsou vloženy žádné fotografie.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPhotos.map((photo) => (
                        <DiaryPhotoCard
                          key={photo.id}
                          photo={photo}
                          onRemove={() => {
                            setLinkedPhotoIds((prev) => prev.filter((id) => id !== photo.id))
                            setSelectedPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                          }}
                        />
                      ))}
                      <DiaryPhotosMap photos={selectedPhotos} />
                    </div>
                  )}
                </Card>
              </Card>

              <Card className="space-y-4">
                <h3 className="font-semibold text-theme-primary">Počasí</h3>
                <div className="flex flex-wrap gap-2">
                  {DIARY_WEATHER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWeatherType(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        weatherType === option.value
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                          : 'border-[var(--border-glass)] bg-white/5 text-theme-secondary hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <Input
                  label="Teplota (°C)"
                  type="number"
                  step="0.5"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="např. 18"
                />
              </Card>

              <Card className="space-y-4">
                <h3 className="font-semibold text-theme-primary">Technika a materiál</h3>
                <DiaryChipSelect
                  label="Použitá technika"
                  hint="Naklikněte použitou techniku"
                  options={DIARY_EQUIPMENT_OPTIONS}
                  selected={equipmentSelected}
                  onChange={setEquipmentSelected}
                  extraLabel="Jiná technika…"
                  extraValue={equipmentCustom}
                  onExtraChange={setEquipmentCustom}
                />
                <DiaryChipSelect
                  label="Materiál"
                  hint="Návrhy z formulářů dělníků + rychlý výběr"
                  options={materialOptions}
                  selected={materialSelected}
                  onChange={setMaterialSelected}
                  extraLabel="Jiný materiál…"
                  extraValue={materialCustom}
                  onExtraChange={setMaterialCustom}
                />
              </Card>

              <Card className="space-y-4">
                <h3 className="font-semibold text-theme-primary">Popis práce</h3>
                <p className="text-sm text-theme-muted">
                  Napište vlastními slovy, co se na stavbě dělalo. AI přepíše text do profesionální podoby pro
                  stavební deník — bez vymýšlení nových údajů.
                </p>
                <Textarea
                  label="Hrubý popis práce"
                  value={roughWorkDescription}
                  onChange={(e) => setRoughWorkDescription(e.target.value)}
                  placeholder="Např.: Kopali jsme rýhu 70 cm, položili dvě HDPE trubky, udělali tři průrazy do domu…"
                  rows={4}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  loading={aiLoading}
                  disabled={roughWorkDescription.trim().length < 8 || aiLoading}
                  onClick={() => void handleAiPolish()}
                >
                  <Sparkles className="h-4 w-4" />
                  Upravit pomocí AI (Gemini)
                </Button>
                <Textarea
                  label="Denní popis práce *"
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  required
                  placeholder="Profesionální popis pro deník — vyplní AI nebo můžete psát ručně…"
                  rows={5}
                />
                {aiAssisted && (
                  <p className="text-xs text-[var(--accent-primary)]">
                    Text byl upraven AI asistentem. Můžete ho ještě ručně doladit před uložením.
                  </p>
                )}
                <Textarea
                  label="Poznámka"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Volitelná poznámka…"
                  rows={2}
                />
                <Textarea
                  label="Mimořádné události"
                  value={extraordinaryEvents}
                  onChange={(e) => setExtraordinaryEvents(e.target.value)}
                  placeholder="Neobvyklé situace, zpoždění, škody…"
                  rows={2}
                />
              </Card>

            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button type="submit" loading={loading} disabled={!orderId || !entryDate}>
              {initial ? 'Uložit zápis' : 'Vytvořit zápis'}
            </Button>
          </div>
        </form>
      </div>

      <DiaryPhotoPickerModal
        open={pickerOpen}
        orderId={orderId}
        entryDate={entryDate}
        selectedIds={linkedPhotoIds}
        currentDiaryEntryId={initial?.id}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ids, photos) => {
          setLinkedPhotoIds(ids)
          setSelectedPhotos(photos)
        }}
      />
    </div>
  )
}
