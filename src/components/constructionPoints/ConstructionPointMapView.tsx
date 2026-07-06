import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import { Layers } from 'lucide-react'
import type { ConstructionPoint } from '@/types/constructionPoints'
import { formatPointLabel } from '@/types/constructionPoints'
import { formatDate } from '@/constants/workers'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]
const MARKER_COLOR = '#06b6d4'
const MARKER_SELECTED = '#a3e635'

const STREET_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}

const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri',
  maxZoom: 19,
}

export type MapLayerMode = 'street' | 'satellite'

function createPointIcon(selected: boolean, label: string): L.DivIcon {
  const color = selected ? MARKER_SELECTED : MARKER_COLOR
  return L.divIcon({
    className: 'photo-map-pin-icon',
    html: `<span class="photo-map-pin" style="--pin-color:${color}"></span><span class="construction-point-badge">${label}</span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
}

interface ConstructionPointMapViewProps {
  points: ConstructionPoint[]
  onPointSelect: (id: string) => void
  selectedPointId?: string | null
  className?: string
  fullHeight?: boolean
  flyToSelected?: boolean
}

export function ConstructionPointMapView({
  points,
  onPointSelect,
  selectedPointId,
  className = '',
  fullHeight = false,
  flyToSelected = false,
}: ConstructionPointMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const onSelectRef = useRef(onPointSelect)
  const [layerMode, setLayerMode] = useState<MapLayerMode>('satellite')

  onSelectRef.current = onPointSelect

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

    tileLayerRef.current = L.tileLayer(SATELLITE_TILES.url, {
      attribution: SATELLITE_TILES.attribution,
      maxZoom: SATELLITE_TILES.maxZoom,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const oldLayer = tileLayerRef.current
    if (!map || !oldLayer) return

    map.removeLayer(oldLayer)
    const config = layerMode === 'satellite' ? SATELLITE_TILES : STREET_TILES
    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map)
  }, [layerMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (points.length === 0) {
      map.setView(CZECH_CENTER, 7)
      return
    }

    const bounds = L.latLngBounds([])

    points.forEach((point) => {
      const latlng = L.latLng(point.gps_lat, point.gps_lng)
      bounds.extend(latlng)

      const isSelected = point.id === selectedPointId
      const badge = String(point.point_number)
      const marker = L.marker(latlng, { icon: createPointIcon(isSelected, badge) })

      marker.on('click', () => onSelectRef.current(point.id))
      marker.bindTooltip(formatPointLabel(point), {
        direction: 'top',
        offset: L.point(0, -36),
        opacity: 0.95,
      })
      marker.bindPopup(
        `<strong>${formatPointLabel(point)}</strong><br/>` +
          `${point.order_name ?? '—'}<br/>` +
          `${formatDate(point.created_at.slice(0, 10))}<br/>` +
          `${point.photo_count ?? 0} fotografií<br/>` +
          `<em>Klikněte pro detail bodu</em>`
      )
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (bounds.isValid()) {
      if (selectedPointId && flyToSelected) {
        const selected = points.find((p) => p.id === selectedPointId)
        if (selected) {
          map.flyTo([selected.gps_lat, selected.gps_lng], Math.max(map.getZoom(), 17), { duration: 0.6 })
        }
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 })
      }
    }
  }, [points, selectedPointId, flyToSelected])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return

    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div className="absolute right-3 top-3 z-[1000] flex rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass)] p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setLayerMode('satellite')}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            layerMode === 'satellite' ? 'bg-accent text-black' : 'text-theme-secondary hover:bg-white/5'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Satelit
        </button>
        <button
          type="button"
          onClick={() => setLayerMode('street')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            layerMode === 'street' ? 'bg-accent text-black' : 'text-theme-secondary hover:bg-white/5'
          }`}
        >
          Klasická mapa
        </button>
      </div>

      <div
        ref={containerRef}
        className={`photo-map-view w-full rounded-2xl neon-border ${fullHeight ? 'photo-map-view--full' : ''}`}
        role="application"
        aria-label="Mapa stavebních bodů"
      />
    </div>
  )
}
