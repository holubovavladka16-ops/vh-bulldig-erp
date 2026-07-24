import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import { distanceMeters } from '@/lib/excavations/geometry'
import type { ExcavationPoint, ExcavationRoute } from '@/types/excavations'

const CZECH_CENTER: L.LatLngExpression = [49.8175, 15.473]
const FREEHAND_MIN_SAMPLE_M = 2.5

export type ExcavationDrawMode = 'points' | 'freehand'

export interface MapFocusTarget {
  lat: number
  lng: number
  zoom?: number
  accuracy?: number
  /** Okamžité vycentrování bez animace (GPS zaměření). */
  immediate?: boolean
}

interface ExcavationMapEditorProps {
  routes: ExcavationRoute[]
  draftPoints: ExcavationPoint[]
  isDrawing: boolean
  drawMode: ExcavationDrawMode
  selectedRouteId: string | null
  mapFocus: MapFocusTarget | null
  userLocation: MapFocusTarget | null
  /** GPS zaměření aktivní – necentrovat mapu na uložené trasy z DB. */
  gpsTrackingActive?: boolean
  /** Změna layoutu (režim měření) – invalidace velikosti mapy. */
  layoutKey?: string
  onMapClick: (point: ExcavationPoint) => void
  onDraftPointsChange: (points: ExcavationPoint[]) => void
  onSelectRoute: (id: string | null) => void
  className?: string
}

export function ExcavationMapEditor({
  routes,
  draftPoints,
  isDrawing,
  drawMode,
  selectedRouteId,
  mapFocus,
  userLocation,
  gpsTrackingActive = false,
  layoutKey,
  onMapClick,
  onDraftPointsChange,
  onSelectRoute,
  className = '',
}: ExcavationMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const userLayerRef = useRef<L.LayerGroup | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const onDraftChangeRef = useRef(onDraftPointsChange)
  const onSelectRef = useRef(onSelectRoute)
  const freehandActiveRef = useRef(false)
  const lastSampleRef = useRef<ExcavationPoint | null>(null)
  const drawModeRef = useRef(drawMode)
  const isDrawingRef = useRef(isDrawing)

  onMapClickRef.current = onMapClick
  onDraftChangeRef.current = onDraftPointsChange
  onSelectRef.current = onSelectRoute
  drawModeRef.current = drawMode
  isDrawingRef.current = isDrawing

  const appendPoint = useCallback((point: ExcavationPoint) => {
    onMapClickRef.current(point)
  }, [])

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!isDrawingRef.current || drawModeRef.current !== 'points') return
    if (freehandActiveRef.current) return
    appendPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
  }, [appendPoint])

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

    layerGroupRef.current = L.layerGroup().addTo(map)
    userLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const handleDrawStart = (e: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current || drawModeRef.current !== 'freehand') return
      freehandActiveRef.current = true
      map.dragging.disable()
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng }
      lastSampleRef.current = pt
      appendPoint(pt)
    }

    const handleDrawMove = (e: L.LeafletMouseEvent) => {
      if (!freehandActiveRef.current || drawModeRef.current !== 'freehand') return
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng }
      const last = lastSampleRef.current
      if (last && distanceMeters(last, pt) >= FREEHAND_MIN_SAMPLE_M) {
        lastSampleRef.current = pt
        appendPoint(pt)
      }
    }

    const handleDrawEnd = () => {
      if (!freehandActiveRef.current) return
      freehandActiveRef.current = false
      lastSampleRef.current = null
      map.dragging.enable()
    }

    map.on('mousedown', handleDrawStart)
    map.on('mousemove', handleDrawMove)
    map.on('mouseup', handleDrawEnd)
    map.on('mouseleave', handleDrawEnd)

    return () => {
      map.off('mousedown', handleDrawStart)
      map.off('mousemove', handleDrawMove)
      map.off('mouseup', handleDrawEnd)
      map.off('mouseleave', handleDrawEnd)
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
      userLayerRef.current = null
    }
  }, [appendPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.off('click')
    map.on('click', handleMapClick)
  }, [handleMapClick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocus) return

    const zoom = mapFocus.zoom ?? 19
    if (mapFocus.immediate) {
      map.setView([mapFocus.lat, mapFocus.lng], zoom, { animate: false })
    } else {
      map.flyTo([mapFocus.lat, mapFocus.lng], zoom, { duration: 0.8 })
    }
  }, [mapFocus])

  useEffect(() => {
    const group = userLayerRef.current
    if (!group) return
    group.clearLayers()
    if (!userLocation) return

    group.addLayer(
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy ?? 8,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1,
        dashArray: '4 4',
      })
    )

    group.addLayer(
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: '#fff',
        fillColor: '#3b82f6',
        fillOpacity: 1,
        weight: 3,
      }).bindTooltip('Vaše poloha', { direction: 'top', permanent: false })
    )
  }, [userLocation])

  useEffect(() => {
    const map = mapRef.current
    const group = layerGroupRef.current
    if (!map || !group) return

    group.clearLayers()
    const bounds = L.latLngBounds([])
    const visibleRoutes = gpsTrackingActive ? [] : routes

    visibleRoutes.forEach((route) => {
      if (route.points.length === 0) return
      const latlngs = route.points.map((p) => L.latLng(p.lat, p.lng))
      latlngs.forEach((ll) => bounds.extend(ll))

      const isSelected = route.id === selectedRouteId
      const polyline = L.polyline(latlngs, {
        color: route.color,
        weight: isSelected ? 6 : 4,
        opacity: 0.95,
      })
      polyline.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectRef.current(route.id)
      })
      polyline.bindTooltip(`${route.name} · ${route.total_length_m.toFixed(1)} m`, { sticky: true })
      group.addLayer(polyline)

      if (isSelected) {
        route.points.forEach((point, index) => {
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: 8,
            color: '#fff',
            fillColor: route.color,
            fillOpacity: 1,
            weight: 2,
          })
          marker.bindTooltip(`Bod ${index + 1}`, { permanent: false })
          group.addLayer(marker)
        })
      }
    })

    if (draftPoints.length > 0) {
      const draftLatLngs = draftPoints.map((p) => L.latLng(p.lat, p.lng))

      if (draftLatLngs.length >= 2) {
        group.addLayer(
          L.polyline(draftLatLngs, {
            color: '#a3e635',
            weight: 5,
            opacity: 0.95,
          })
        )
      }

      draftPoints.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lng], {
          draggable: isDrawing,
          icon: L.divIcon({
            className: 'excavation-vertex-icon',
            html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:#a3e635;border:2px solid #fff;box-shadow:0 0 8px #a3e635"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        })

        if (isDrawing) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            const next = draftPoints.map((p, i) =>
              i === index ? { lat: pos.lat, lng: pos.lng } : p
            )
            onDraftChangeRef.current(next)
          })
        }

        marker.bindTooltip(
          `Bod ${index + 1}${index === 0 ? ' (Start)' : index === draftPoints.length - 1 ? ' (Konec)' : ''}`,
          { direction: 'top' }
        )
        group.addLayer(marker)
      })
    }

    if (!isDrawing && bounds.isValid() && visibleRoutes.length > 0 && !selectedRouteId && !gpsTrackingActive) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 })
    }
  }, [routes, draftPoints, selectedRouteId, isDrawing, gpsTrackingActive])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const timer = window.setTimeout(() => map.invalidateSize(), 150)
    return () => window.clearTimeout(timer)
  }, [layoutKey])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (isDrawing && drawMode === 'freehand') {
      container.classList.add('photo-map-view--freehand')
    } else {
      container.classList.remove('photo-map-view--freehand')
    }
  }, [isDrawing, drawMode])

  return (
    <div
      ref={containerRef}
      className={`photo-map-view photo-map-view--full w-full rounded-2xl neon-border ${className}`}
      role="application"
      aria-label="Mapa pro kreslení trasy výkopu"
    />
  )
}
