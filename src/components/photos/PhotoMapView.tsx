import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import type { GpsPhoto } from '@/types/photos'
import { formatDate } from '@/constants/workers'
import { formatPhotoAddress, getOrderDisplayName } from '@/lib/photos/photoDisplay'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]
const MARKER_COLOR = '#06b6d4'
const MARKER_SELECTED = '#a3e635'

function createPinIcon(selected: boolean): L.DivIcon {
  const color = selected ? MARKER_SELECTED : MARKER_COLOR
  return L.divIcon({
    className: 'photo-map-pin-icon',
    html: `<span class="photo-map-pin" style="--pin-color:${color}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
}

interface PhotoMapViewProps {
  photos: GpsPhoto[]
  onPhotoSelect: (id: string) => void
  selectedPhotoId?: string | null
  className?: string
  fullHeight?: boolean
  flyToSelected?: boolean
}

export function PhotoMapView({
  photos,
  onPhotoSelect,
  selectedPhotoId,
  className = '',
  fullHeight = false,
  flyToSelected = false,
}: PhotoMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
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
      if (photo.gps_lat == null || photo.gps_lng == null) return

      const latlng = L.latLng(photo.gps_lat, photo.gps_lng)
      bounds.extend(latlng)

      const isSelected = photo.id === selectedPhotoId
      const marker = L.marker(latlng, { icon: createPinIcon(isSelected) })

      marker.on('click', () => onSelectRef.current(photo.id))
      marker.bindTooltip(getOrderDisplayName(photo), {
        direction: 'top',
        offset: L.point(0, -36),
        opacity: 0.95,
      })
      marker.bindPopup(
        `<strong>${getOrderDisplayName(photo)}</strong><br/>` +
          `${formatDate(photo.captured_date)} ${photo.captured_time.slice(0, 5)}<br/>` +
          `${formatPhotoAddress(photo)}<br/>` +
          `<em>Klikněte pro detail fotky</em>`
      )
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (bounds.isValid()) {
      if (selectedPhotoId && flyToSelected) {
        const selected = photos.find((p) => p.id === selectedPhotoId)
        if (selected?.gps_lat != null && selected.gps_lng != null) {
          map.flyTo([selected.gps_lat, selected.gps_lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
        }
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 })
      }
    }
  }, [photos, selectedPhotoId, flyToSelected])

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
      className={`photo-map-view w-full rounded-2xl neon-border ${fullHeight ? 'photo-map-view--full' : ''} ${className}`}
      role="application"
      aria-label="Mapa fotografií s GPS špendlíky"
    />
  )
}
