import { useEffect, useState } from 'react'
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PhotoCaptureModal } from '@/components/photos/PhotoCaptureModal'
import { PhotoDocumentView } from '@/components/photos/PhotoDocumentView'
import {
  createConstructionPointNote,
  deleteConstructionPoint,
  deleteConstructionPointNote,
  deletePhotoFromPoint,
  fetchConstructionPointDetail,
  getGpsPhotoUrl,
  reorderConstructionPointPhotos,
  updateConstructionPoint,
  updateConstructionPointNote,
} from '@/lib/constructionPoints/api'
import { getGpsPhotoThumbnailUrl, updateGpsPhotoNote } from '@/lib/photos/api'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
} from '@/lib/photos/photoDisplay'
import { formatPointLabel } from '@/types/constructionPoints'
import type { ConstructionPointDetail } from '@/types/constructionPoints'
import type { GpsPhoto } from '@/types/photos'
import { formatDate, formatDateTime } from '@/constants/workers'

interface ConstructionPointDetailPanelProps {
  pointId: string
  onClose: () => void
  onUpdated: () => void
  onOpenPhotoLightbox?: (photos: GpsPhoto[], index: number) => void
}

export function ConstructionPointDetailPanel({
  pointId,
  onClose,
  onUpdated,
  onOpenPhotoLightbox,
}: ConstructionPointDetailPanelProps) {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'administrator'

  const [detail, setDetail] = useState<ConstructionPointDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editName, setEditName] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState('')

  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  const [showAddPhoto, setShowAddPhoto] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const selectedPhoto = detail?.photos.find((p) => p.id === selectedPhotoId) ?? null

  function openPhoto(photo: GpsPhoto, index: number) {
    if (onOpenPhotoLightbox && detail) {
      onOpenPhotoLightbox(detail.photos, index)
      return
    }
    setSelectedPhotoId(photo.id)
  }

  async function reload() {
    const data = await fetchConstructionPointDetail(pointId)
    setDetail(data)
    if (data) {
      setEditName(data.name)
      setEditLat(String(data.gps_lat))
      setEditLng(String(data.gps_lng))
    }
    onUpdated()
  }

  useEffect(() => {
    setLoading(true)
    setSelectedPhotoId(null)
    setEditMode(false)
    fetchConstructionPointDetail(pointId)
      .then((data) => {
        setDetail(data)
        if (data) {
          setEditName(data.name)
          setEditLat(String(data.gps_lat))
          setEditLng(String(data.gps_lng))
        }
      })
      .finally(() => setLoading(false))
  }, [pointId])

  useEffect(() => {
    setPhotoNote(selectedPhoto?.note ?? '')
  }, [selectedPhoto])

  async function handleSavePoint() {
    if (!user || !detail) return
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { name: editName.trim() || detail.name }
      if (isAdmin) {
        const lat = Number(editLat)
        const lng = Number(editLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error('Neplatné GPS souřadnice.')
        }
        payload.gps_lat = lat
        payload.gps_lng = lng
      }
      await updateConstructionPoint(detail.id, payload, user.id)
      setEditMode(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePoint() {
    if (!user || !detail) return
    if (
      !confirm(
        `Smazat stavební bod „${formatPointLabel(detail)}" včetně ${detail.photos.length} fotografií a všech poznámek?`
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await deleteConstructionPoint(detail.id, user.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smazání se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!user || !detail) return
    setSaving(true)
    try {
      await createConstructionPointNote(detail.id, newNote, user.id)
      setNewNote('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poznámku se nepodařilo uložit')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateNote(noteId: string) {
    if (!user || !detail) return
    setSaving(true)
    try {
      await updateConstructionPointNote(noteId, detail.id, editingNoteText, user.id)
      setEditingNoteId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úprava poznámky se nezdařila')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!user || !detail) return
    if (!confirm('Smazat tuto poznámku?')) return
    setSaving(true)
    try {
      await deleteConstructionPointNote(noteId, detail.id, user.id)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function movePhoto(photo: GpsPhoto, direction: -1 | 1) {
    if (!user || !detail) return
    const index = detail.photos.findIndex((p) => p.id === photo.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= detail.photos.length) return

    const ids = detail.photos.map((p) => p.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]

    setSaving(true)
    try {
      await reorderConstructionPointPhotos(detail.id, ids, user.id)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePhoto(photo: GpsPhoto) {
    if (!user || !detail) return
    if (!confirm(`Smazat fotografii „${photo.file_name}"?`)) return
    setSaving(true)
    try {
      await deletePhotoFromPoint(photo, detail.id, user.id)
      if (selectedPhotoId === photo.id) setSelectedPhotoId(null)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePhotoNote() {
    if (!user || !selectedPhoto) return
    setSaving(true)
    try {
      await updateGpsPhotoNote(selectedPhoto.id, photoNote, user.id)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const combinedHistory = [
    ...(detail?.history.map((h) => ({
      id: h.id,
      at: h.created_at,
      action: h.action,
      type: 'point' as const,
    })) ?? []),
    ...(detail?.photo_history.map((h) => ({
      id: h.id,
      at: h.created_at,
      action: h.action,
      type: 'photo' as const,
    })) ?? []),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
        aria-label="Zavřít detail"
      />

      <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] lg:static lg:z-auto lg:h-full lg:max-h-none lg:w-[min(440px,40vw)] lg:shrink-0 lg:rounded-2xl lg:shadow-[0_0_24px_var(--accent-glow)]">
        <div className="relative flex items-center justify-between border-b border-[var(--border-glass)] px-4 py-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20 lg:hidden" aria-hidden />
          <h3 className="text-sm font-bold text-theme-primary">Stavební bod</h3>
          <button type="button" onClick={onClose} className="touch-target rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <ChevronDown className="h-5 w-5 lg:hidden" />
            <X className="hidden h-5 w-5 lg:block" />
          </button>
        </div>

        <div className="scrollbar-premium flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
            </div>
          ) : !detail ? (
            <p className="py-12 text-center text-sm text-theme-secondary">Stavební bod nenalezen.</p>
          ) : selectedPhoto ? (
            <div className="space-y-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedPhotoId(null)}>
                <ChevronLeft className="h-4 w-4" />
                Zpět na bod
              </Button>
              <PhotoDocumentView
                photo={selectedPhoto}
                note={photoNote}
                onNoteChange={setPhotoNote}
                onSaveNote={handleSavePhotoNote}
                savingNote={saving}
                userId={user?.id}
                onDelete={() => void handleDeletePhoto(selectedPhoto)}
                deleting={saving}
                onShared={reload}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                  Tečka č. {detail.point_number}
                </p>
                {editMode ? (
                  <div className="mt-2 space-y-2">
                    <Input label="Název bodu" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    {isAdmin && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="GPS lat" value={editLat} onChange={(e) => setEditLat(e.target.value)} />
                        <Input label="GPS lng" value={editLng} onChange={(e) => setEditLng(e.target.value)} />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" loading={saving} onClick={() => void handleSavePoint()}>
                        <Save className="h-4 w-4" />
                        Uložit
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                        Zrušit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-theme-primary">{formatPointLabel(detail)}</h2>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-theme-muted">Zakázka</dt>
                  <dd className="font-medium text-theme-primary">{detail.order_name ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-xs text-theme-muted">Datum</dt>
                    <dd>{formatCaptureDateLabel(detail.created_at.slice(0, 10))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-theme-muted">Čas</dt>
                    <dd>{formatCaptureTime(detail.created_at.slice(11, 19))}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">Adresa</dt>
                  <dd>{formatPhotoAddress(detail)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">GPS</dt>
                  <dd className="font-mono text-xs">{formatGpsCoordinatesCompact(detail.gps_lat, detail.gps_lng)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
                  <dd>
                    {detail.gps_accuracy != null
                      ? `±${detail.gps_accuracy < 10 ? detail.gps_accuracy.toFixed(1) : Math.round(detail.gps_accuracy)} m`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">Vytvořil</dt>
                  <dd>{detail.creator_name ?? '—'}</dd>
                </div>
              </dl>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-theme-primary">
                    Fotografie ({detail.photos.length})
                  </h3>
                  <Button type="button" size="sm" onClick={() => setShowAddPhoto(true)}>
                    <Camera className="h-4 w-4" />
                    Přidat
                  </Button>
                </div>

                {detail.photos.length === 0 ? (
                  <p className="text-sm text-theme-muted">Zatím žádné fotografie v tomto bodu.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.photos.map((photo, index) => (
                      <li
                        key={photo.id}
                        className="flex items-center gap-2 rounded-xl border border-[var(--border-glass)] p-2"
                      >
                        <button
                          type="button"
                          onClick={() => openPhoto(photo, index)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <img
                            src={getGpsPhotoThumbnailUrl(photo.file_path, 112, 112)}
                            alt={`Fotografie ${index + 1}`}
                            loading="lazy"
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            onError={(event) => {
                              const img = event.currentTarget
                              if (img.src !== getGpsPhotoUrl(photo.file_path)) {
                                img.src = getGpsPhotoUrl(photo.file_path)
                              }
                            }}
                          />
                          <span>
                            <span className="block text-sm font-medium text-theme-primary">
                              Fotografie {index + 1}
                            </span>
                            <span className="text-xs text-theme-muted">
                              {formatDate(photo.captured_date)} {photo.captured_time.slice(0, 5)}
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            disabled={index === 0 || saving}
                            onClick={() => void movePhoto(photo, -1)}
                            className="rounded p-1 hover:bg-white/5 disabled:opacity-30"
                            aria-label="Posunout nahoru"
                          >
                            <ChevronLeft className="h-4 w-4 rotate-90" />
                          </button>
                          <button
                            type="button"
                            disabled={index === detail.photos.length - 1 || saving}
                            onClick={() => void movePhoto(photo, 1)}
                            className="rounded p-1 hover:bg-white/5 disabled:opacity-30"
                            aria-label="Posunout dolů"
                          >
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 font-semibold text-theme-primary">Zápisník poznámek</h3>
                <div className="space-y-3">
                  <Textarea
                    label="Nová poznámka"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    placeholder="Zadejte poznámku k tomuto místu…"
                  />
                  <Button
                    type="button"
                    size="sm"
                    loading={saving}
                    disabled={!newNote.trim()}
                    onClick={() => void handleAddNote()}
                  >
                    <Plus className="h-4 w-4" />
                    Přidat poznámku
                  </Button>

                  {detail.notes.length === 0 ? (
                    <p className="text-sm text-theme-muted">Zatím žádné poznámky.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.notes.map((note) => (
                        <li key={note.id} className="rounded-xl border border-[var(--border-glass)] p-3">
                          {editingNoteId === note.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" loading={saving} onClick={() => void handleUpdateNote(note.id)}>
                                  Uložit
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                                  Zrušit
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap text-sm text-theme-primary">{note.content}</p>
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-theme-muted">
                                <span>
                                  {note.author_name ?? '—'} · {formatDateTime(note.created_at)}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-white/5"
                                    onClick={() => {
                                      setEditingNoteId(note.id)
                                      setEditingNoteText(note.content)
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded p-1 text-red-400 hover:bg-white/5"
                                    onClick={() => void handleDeleteNote(note.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--border-glass)] px-3 py-2 text-sm font-medium text-theme-primary hover:bg-white/5"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-accent" />
                    Historie úprav ({combinedHistory.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 transition ${showHistory ? 'rotate-180' : ''}`} />
                </button>
                {showHistory && (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-theme-secondary">
                    {combinedHistory.map((entry) => (
                      <li key={entry.id} className="flex gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                        <Clock className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                        <span>
                          <strong>{entry.action}</strong>
                          <span className="block text-theme-muted">{formatDateTime(entry.at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isAdmin && (
                <Button type="button" variant="danger" size="sm" loading={saving} onClick={() => void handleDeletePoint()}>
                  <Trash2 className="h-4 w-4" />
                  Smazat celý stavební bod
                </Button>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          )}
        </div>
      </aside>

      {showAddPhoto && detail && user && (
        <PhotoCaptureModal
          open={showAddPhoto}
          onClose={() => setShowAddPhoto(false)}
          onCreated={() => {
            setShowAddPhoto(false)
            void reload()
          }}
          uploadedBy={user.id}
          creatorName={profile?.full_name?.trim() || user.email || '—'}
          constructionPointId={detail.id}
          defaultOrderId={detail.order_id ?? undefined}
          lockOrder
        />
      )}
    </>
  )
}
