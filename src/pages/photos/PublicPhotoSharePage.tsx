import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, ExternalLink } from 'lucide-react'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { formatDate } from '@/constants/workers'
import { fetchPublicGpsPhoto, getPublicGpsPhotoImageUrl } from '@/lib/photos/publicShare'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import { APP_INFO } from '@/constants/navigation'

export function PublicPhotoSharePage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof fetchPublicGpsPhoto>>>(null)

  useEffect(() => {
    if (!id?.trim()) {
      setError('Neplatný odkaz na fotografii.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetchPublicGpsPhoto(id.trim())
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setError('Fotografie nebyla nalezena nebo odkaz již není platný.')
          return
        }
        setPhoto(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Načtení fotografie se nezdařilo.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const imageUrl = photo ? getPublicGpsPhotoImageUrl(photo.file_path) : ''
  const mapUrl = photo ? getGoogleMapsUrl(photo.gps_lat, photo.gps_lng) : ''
  const address =
    photo?.address_full?.trim() ||
    [photo?.street, photo?.city, photo?.postal_code].filter(Boolean).join(', ') ||
    '—'

  return (
    <div className="app-background min-h-dvh">
      <header className="glass-panel neon-border sticky top-0 z-40 border-b !rounded-none px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 p-1">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-theme-primary">{APP_INFO.shortName}</p>
            <p className="text-xs text-theme-muted">Sdílená fotodokumentace (pouze pro čtení)</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 pb-8">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && photo && (
          <>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-black/40">
              <img
                src={imageUrl}
                alt={photo.file_name || 'Fotodokumentace'}
                className="max-h-[70dvh] w-full object-contain"
                loading="eager"
              />
            </div>

            <div className="glass-panel neon-border space-y-3 rounded-2xl p-4 text-sm">
              <h1 className="text-base font-semibold text-theme-primary">
                {photo.order_name || 'Fotodokumentace VH Bulldig'}
              </h1>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-theme-muted">Datum a čas</dt>
                  <dd className="text-theme-primary">
                    {formatDate(photo.captured_date)} · {photo.captured_time?.slice(0, 5)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">GPS</dt>
                  <dd className="text-theme-primary">
                    {photo.gps_lat.toFixed(5)}, {photo.gps_lng.toFixed(5)}
                    {photo.gps_accuracy != null ? ` (±${Math.round(photo.gps_accuracy)} m)` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-muted">Adresa</dt>
                  <dd className="text-theme-primary">{address}</dd>
                </div>
                {photo.note?.trim() && (
                  <div>
                    <dt className="text-xs text-theme-muted">Poznámka</dt>
                    <dd className="text-theme-primary">{photo.note}</dd>
                  </div>
                )}
              </dl>

              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-glass)] px-4 py-2 text-sm text-accent hover:bg-white/5"
              >
                <MapPin className="h-4 w-4" />
                Otevřít na mapě
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </>
        )}

        <p className="text-center text-xs text-theme-muted">
          Toto je veřejný náhled konkrétní fotografie. Pro správu fotodokumentace se{' '}
          <Link to="/prihlaseni" className="text-accent hover:underline">
            přihlaste do ERP
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
