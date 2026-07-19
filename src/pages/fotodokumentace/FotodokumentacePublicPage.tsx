import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { getMapyCzUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { formatDate, formatTime } from '@/constants/workers'

interface PublicFoto {
  id: string
  file_path: string
  file_name: string
  captured_date: string
  captured_time: string
  address_full: string
  note: string | null
  order_name: string | null
  gps_lat?: number | null
  gps_lng?: number | null
}

export function FotodokumentacePublicPage() {
  const { id } = useParams<{ id: string }>()
  const [foto, setFoto] = useState<PublicFoto | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    supabase
      .rpc('get_public_gps_photo', { p_photo_id: id })
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Fotografie není dostupná.')
          return
        }
        setFoto(data as PublicFoto)
      })
  }, [id])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-6">
        <p className="text-theme-secondary">{error}</p>
      </div>
    )
  }

  if (!foto) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-theme-primary">Sdílená fotografie</h1>
        <img
          src={getFotoUrl(foto.file_path)}
          alt=""
          className="w-full rounded-xl border border-[var(--border-glass)]"
        />
        <div className="space-y-1 text-sm text-theme-secondary">
          <p><strong>Zakázka:</strong> {foto.order_name ?? '—'}</p>
          <p><strong>Datum:</strong> {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}</p>
          <p><strong>Adresa:</strong> {foto.address_full}</p>
          {foto.note && <p><strong>Poznámka:</strong> {foto.note}</p>}
        </div>
        {foto.gps_lat != null && foto.gps_lng != null && (
          <div className="flex flex-wrap gap-2">
            <a
              href={getMapyCzUrl(foto.gps_lat, foto.gps_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-glass)] px-3 py-2 text-sm text-theme-primary"
            >
              <MapPin className="h-4 w-4 text-red-400" />
              Mapy.cz
            </a>
            <a
              href={getStreetViewUrl(foto.gps_lat, foto.gps_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-glass)] px-3 py-2 text-sm text-theme-primary"
            >
              Street View
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
