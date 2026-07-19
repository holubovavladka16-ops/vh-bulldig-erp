import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import { formatDate, formatTime } from '@/constants/workers'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import type { FotoDokument } from '@/types/fotodokumentace'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]

interface FotoMapViewProps {
  fotografie: FotoDokument[]
  selectedId?: string | null
  onSelect: (id: string) => void
  className?: string
  fullHeight?: boolean
}

export function FotoMapView({
  fotografie,
  selectedId,
  onSelect,
  className = '',
  fullHeight = false,
}: FotoMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const withGps = fotografie.filter((f) => f.gps_lat != null && f.gps_lng != null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
    }).setView(CZECH_CENTER, 7)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const groups = new Map<string, FotoDokument[]>()
    for (const foto of withGps) {
      const key = `${Number(foto.gps_lat).toFixed(5)}_${Number(foto.gps_lng).toFixed(5)}`
      const list = groups.get(key) ?? []
      list.push(foto)
      groups.set(key, list)
    }

    groups.forEach((group) => {
      const foto = group[0]
      const lat = Number(foto.gps_lat)
      const lng = Number(foto.gps_lng)
      const selected = group.some((f) => f.id === selectedId)

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'photo-map-pin-icon',
          html: `<span class="photo-map-pin" style="--pin-color:${selected ? '#a3e635' : '#06b6d4'}">${group.length > 1 ? group.length : ''}</span>`,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        }),
      }).addTo(map)

      const thumb = getFotoUrl(foto.thumbnail_path ?? foto.file_path)
      marker.bindPopup(`
        <div style="min-width:160px">
          <img src="${thumb}" style="width:100%;border-radius:8px;margin-bottom:6px" />
          <strong>${foto.order_name ?? '—'}</strong><br/>
          ${formatDate(foto.captured_date)} ${formatTime(foto.captured_time)}<br/>
          ${foto.address_full}<br/>
          ${group.length > 1 ? `<em>${group.length} fotografií</em>` : ''}
        </div>
      `)

      marker.on('click', () => onSelectRef.current(foto.id))
      markersRef.current.push(marker)
    })

    if (withGps.length > 0) {
      const bounds = L.latLngBounds(withGps.map((f) => [Number(f.gps_lat), Number(f.gps_lng)]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [withGps, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const foto = withGps.find((f) => f.id === selectedId)
    if (foto) map.flyTo([Number(foto.gps_lat), Number(foto.gps_lng)], 17, { duration: 0.5 })
  }, [selectedId, withGps])

  return (
    <div
      ref={containerRef}
      className={`photo-map-container rounded-xl border border-[var(--border-glass)] ${fullHeight ? 'min-h-[70vh]' : 'min-h-[320px]'} ${className}`}
    />
  )
}
