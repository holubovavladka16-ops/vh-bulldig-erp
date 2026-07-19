import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { getMapyCzUrl } from '@/lib/photos/mapLinks'
import { formatDate, formatTime } from '@/constants/workers'
import { getTypFotografieLabel } from '@/constants/fotodokumentace'

interface PublicGalleryPhoto {
  id: string
  file_path: string
  file_name: string
  captured_date: string
  captured_time: string
  address_full: string | null
  gps_lat: number | null
  gps_lng: number | null
  note: string | null
  photo_type: string | null
}

interface PublicGalleryData {
  order_name: string
  allow_download: boolean
  show_address: boolean
  show_gps: boolean
  photos: PublicGalleryPhoto[]
}

export function FotodokumentacePublicGalleryPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicGalleryData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    supabase.rpc('get_public_photo_gallery', { p_token: token }).then(({ data: raw, error: err }) => {
      if (err || !raw) {
        setError('Galerie není dostupná nebo vypršela platnost.')
        return
      }
      setData(raw as PublicGalleryData)
    })
  }, [token])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-6">
        <p className="text-theme-secondary">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-theme-primary">Fotodokumentace zakázky</h1>
          <p className="text-theme-secondary">{data.order_name}</p>
          <p className="text-sm text-theme-muted">{data.photos.length} fotografií</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {data.photos.map((foto) => (
            <article key={foto.id} className="overflow-hidden rounded-xl border border-[var(--border-glass)] bg-white/5">
              <img
                src={getFotoUrl(foto.file_path)}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="space-y-1 p-3 text-sm">
                <p className="font-medium text-theme-primary">
                  {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}
                </p>
                <p className="text-xs text-theme-muted">{getTypFotografieLabel(foto.photo_type)}</p>
                {data.show_address && foto.address_full && (
                  <p className="text-theme-secondary">{foto.address_full}</p>
                )}
                {data.show_gps && foto.gps_lat != null && foto.gps_lng != null && (
                  <a
                    href={getMapyCzUrl(foto.gps_lat, foto.gps_lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400"
                  >
                    <MapPin className="h-3 w-3" />
                    Mapa polohy
                  </a>
                )}
                {foto.note && <p className="text-xs text-theme-muted">{foto.note}</p>}
                {data.allow_download && (
                  <a
                    href={getFotoUrl(foto.file_path)}
                    download={foto.file_name}
                    className="inline-block text-xs text-[var(--accent-primary)]"
                  >
                    Stáhnout
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
