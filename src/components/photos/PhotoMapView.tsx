import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import type { GpsPhoto } from '@/types/photos'
import { formatDate } from '@/constants/workers'
import { formatPhotoAddress } from '@/lib/photos/photoDisplay'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]
const MARKER_COLOR = '#06b6d4'

interface PhotoMapViewProps {
  photos: GpsPhoto[]
  onPhotoSelect: (id: string) => void
  selectedPhotoId?: string | null
  className?: string
}

export function PhotoMapView({
  photos,
  onPhotoSelect,
  selectedPhotoId,
  className = '',
}: PhotoMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const onSelectRef = useRef(onPhotoSelect)

  onSelectRef.current = onPhotoSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
    }).setView(CZECH_CENTER, 7)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (photos.length === 0) {
      map.setView(CZECH_CENTER, 7)
      return
    }

    const bounds = L.latLngBounds([])

    photos.forEach((photo) => {
      const latlng = L.latLng(photo.gps_lat, photo.gps_lng)
      bounds.extend(latlng)

      const isSelected = photo.id === selectedPhotoId
      const marker = L.circleMarker(latlng, {
        radius: isSelected ? 12 : 9,
        color: isSelected ? '#ffffff' : MARKER_COLOR,
        fillColor: MARKER_COLOR,
        fillOpacity: isSelected ? 1 : 0.92,
        weight: isSelected ? 3 : 2,
      })

      marker.on('click', () => onSelectRef.current(photo.id))
      marker.bindTooltip(
        `${formatDate(photo.captured_date)} · ${photo.captured_time.slice(0, 5)}`,
        { direction: 'top', offset: L.point(0, -10), opacity: 0.95 }
      )
      marker.bindPopup(
        `<strong>${formatDate(photo.captured_date)} ${photo.captured_time.slice(0, 5)}</strong><br/>` +
          `${formatPhotoAddress(photo)}<br/>` +
          `${photo.order_name ? `Zakázka: ${photo.order_name}<br/>` : ''}` +
          `${photo.note ? `${photo.note}<br/>` : ''}` +
          `<em>Klikněte pro detail</em>`
      )
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 })
    }
  }, [photos, selectedPhotoId])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return

    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`photo-map-view w-full rounded-2xl neon-border ${className}`}
      role="application"
      aria-label="Mapa fotografií s GPS tečkami"
    />
  )
}
