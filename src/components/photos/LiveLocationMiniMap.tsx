import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface LiveLocationMiniMapProps {
  lat: number | null
  lng: number | null
  accuracy?: number | null
  className?: string
  height?: number
}

export function LiveLocationMiniMap({
  lat,
  lng,
  accuracy,
  className = '',
  height = 120,
}: LiveLocationMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const accuracyRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    }).setView([49.8175, 15.473], 7)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      accuracyRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markerRef.current?.remove()
    accuracyRef.current?.remove()
    markerRef.current = null
    accuracyRef.current = null

    if (lat == null || lng == null) return

    const latlng = L.latLng(lat, lng)

    if (accuracy != null && accuracy > 0) {
      accuracyRef.current = L.circle(latlng, {
        radius: accuracy,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1,
        dashArray: '3 3',
      }).addTo(map)
    }

    markerRef.current = L.circleMarker(latlng, {
      radius: 7,
      color: '#fff',
      fillColor: '#06b6d4',
      fillOpacity: 1,
      weight: 2,
    }).addTo(map)

    map.setView(latlng, 17, { animate: true })
  }, [lat, lng, accuracy])

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
      className={`overflow-hidden rounded-xl border border-white/20 bg-black/40 ${className}`}
      style={{ height: `${height}px` }}
      aria-label="Malá mapa s aktuální polohou"
    />
  )
}
