import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import { MapToolbar } from '@/components/photos/MapToolbar'
import {
  createPhotoMarkerClusterGroup,
  fitMapToBounds,
  flyToMyLocation,
} from '@/lib/map/markerCluster'
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
    className: 'photo-map-pin-icon photo-map-pin-icon--point',
    html: `<span class="photo-map-pin photo-map-pin--point" style="--pin-color:${color}"></span><span class="construction-point-badge">${label}</span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
}

function buildPointPopupHtml(point: ConstructionPoint): string {
  const note = point.name?.trim()
  return `
    <div class="photo-map-popup">
      <strong class="photo-map-popup__title">${formatPointLabel(point)}</strong>
      <p class="photo-map-popup__meta">${point.order_name ?? '—'}</p>
      <p class="photo-map-popup__meta">${formatDate(point.created_at.slice(0, 10))}</p>
      <p class="photo-map-popup__meta">${point.photo_count ?? 0} fotografií</p>
      ${note && note !== formatPointLabel(point) ? `<p class="photo-map-popup__note">${note.slice(0, 120)}</p>` : ''}
      <button type="button" class="photo-map-popup__btn" data-point-id="${point.id}">Otevřít detail</button>
    </div>
  `
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
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const boundsRef = useRef<L.LatLngBounds | null>(null)
  const onSelectRef = useRef(onPointSelect)
  const [layerMode, setLayerMode] = useState<MapLayerMode>('satellite')
  const [status, setStatus] = useState('')

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

    const cluster = createPhotoMarkerClusterGroup()
    cluster.addTo(map)
    clusterRef.current = cluster
    mapRef.current = map

    map.on('popupopen', (event) => {
      const popup = event.popup
      const el = popup.getElement()
      if (!el) return
      const btn = el.querySelector<HTMLButtonElement>('[data-point-id]')
      if (!btn) return
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-point-id')
        if (id) onSelectRef.current(id)
        map.closePopup()
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
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
    const cluster = clusterRef.current
    if (!map || !cluster) return

    cluster.clearLayers()

    if (points.length === 0) {
      boundsRef.current = null
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
      marker.bindPopup(buildPointPopupHtml(point), {
        maxWidth: 280,
        minWidth: 220,
        className: 'photo-map-popup-wrap',
      })
      cluster.addLayer(marker)
    })

    boundsRef.current = bounds.isValid() ? bounds : null

    if (bounds.isValid()) {
      if (selectedPointId && flyToSelected) {
        const selected = points.find((p) => p.id === selectedPointId)
        if (selected) {
          map.flyTo([selected.gps_lat, selected.gps_lng], Math.max(map.getZoom(), 17), { duration: 0.6 })
        }
      } else {
        fitMapToBounds(map, bounds)
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

  function handleFitAll() {
    const map = mapRef.current
    const bounds = boundsRef.current
    if (map && bounds) fitMapToBounds(map, bounds)
    setStatus('')
  }

  async function handleMyLocation() {
    const map = mapRef.current
    if (!map) return
    try {
      await flyToMyLocation(map)
      setStatus('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Polohu se nepodařilo získat.')
    }
  }

  return (
    <div className={`relative ${className}`}>
      <MapToolbar
        layerMode={layerMode}
        onLayerModeChange={setLayerMode}
        onFitAll={handleFitAll}
        onMyLocation={() => void handleMyLocation()}
      />
      {status && <p className="photo-map-status">{status}</p>}
      <div
        ref={containerRef}
        className={`photo-map-view w-full rounded-2xl neon-border ${fullHeight ? 'photo-map-view--full' : ''}`}
        role="application"
        aria-label="Mapa stavebních bodů"
      />
    </div>
  )
}
