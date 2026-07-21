import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import type { GpsPhoto } from '@/types/photos'
import { formatPhotoAddress, getOrderDisplayName } from '@/lib/photos/photoDisplay'
import { formatDate } from '@/constants/workers'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]
const USER_COLOR = '#f59e0b'
const PIN_COLOR = '#06b6d4'
const PIN_SELECTED = '#a3e635'

function createPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'photo-map-pin-icon',
    html: `<span class="photo-map-pin" style="--pin-color:${color}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
}

interface GfaLocationMapProps {
  userLat?: number | null
  userLng?: number | null
  userAccuracy?: number | null
  photos?: GpsPhoto[]
  selectedPhotoId?: string | null
  onPhotoSelect?: (id: string) => void
  className?: string
  fullHeight?: boolean
}

export function GfaLocationMap({
  userLat,
  userLng,
  userAccuracy,
  photos = [],
  selectedPhotoId,
  onPhotoSelect,
  className = '',
  fullHeight = false,
}: GfaLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Layer[]>([])
  const onSelectRef = useRef(onPhotoSelect)
  onSelectRef.current = onPhotoSelect

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

    markersRef.current.forEach((layer) => layer.remove())
    markersRef.current = []

    const bounds = L.latLngBounds([])

    if (userLat != null && userLng != null) {
      const userLatLng = L.latLng(userLat, userLng)
      bounds.extend(userLatLng)
      const userMarker = L.circleMarker(userLatLng, {
        radius: 8,
        color: USER_COLOR,
        fillColor: USER_COLOR,
        fillOpacity: 0.85,
        weight: 2,
      })
      userMarker.bindTooltip('Vaše poloha', { direction: 'top', offset: L.point(0, -8) })
      userMarker.addTo(map)
      markersRef.current.push(userMarker)

      if (userAccuracy && userAccuracy > 0) {
        const accuracyCircle = L.circle(userLatLng, {
          radius: userAccuracy,
          color: USER_COLOR,
          fillColor: USER_COLOR,
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '4 4',
        })
        accuracyCircle.addTo(map)
        markersRef.current.push(accuracyCircle)
      }
    }

    photos.forEach((photo) => {
      const latlng = L.latLng(photo.gps_lat, photo.gps_lng)
      bounds.extend(latlng)
      const isSelected = photo.id === selectedPhotoId
      const marker = L.marker(latlng, {
        icon: createPinIcon(isSelected ? PIN_SELECTED : PIN_COLOR),
      })
      marker.on('click', () => onSelectRef.current?.(photo.id))
      marker.bindPopup(
        `<strong>${getOrderDisplayName(photo)}</strong><br/>` +
          `${formatDate(photo.captured_date)} ${photo.captured_time.slice(0, 5)}<br/>` +
          `${formatPhotoAddress(photo)}`
      )
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (bounds.isValid()) {
      if (userLat != null && userLng != null && photos.length === 0) {
        map.setView([userLat, userLng], 18)
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 })
      }
    }
  }, [userLat, userLng, userAccuracy, photos, selectedPhotoId])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`photo-map-view w-full rounded-2xl neon-border ${fullHeight ? 'photo-map-view--full' : 'min-h-[280px]'} ${className}`}
      role="application"
      aria-label="Mapa s aktuální polohou a fotografiemi"
    />
  )
}
