import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/styles/photoMap.css'
import '@/styles/projectMap.css'
import {
  PROJECT_MAP_CZECH_CENTER,
  PROJECT_MAP_DEFAULT_ZOOM,
  PROJECT_MAP_SINGLE_MARKER_ZOOM,
  PROJECT_MARKER_COLOR_HEX,
} from '@/constants/zakazkyMapa'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createProjectPinIcon(color: string, label: string, selected: boolean): L.DivIcon {
  const safeLabel = escapeHtml(label)
  return L.divIcon({
    className: 'project-map-pin-icon',
    html:
      `<span class="project-map-pin ${selected ? 'project-map-pin--selected' : ''}" style="--pin-color:${color}">` +
      `<span class="project-map-pin-label">${safeLabel}</span>` +
      '</span>',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -40],
  })
}

interface ProjectMapViewProps {
  items: ProjectMapMarkerWithOrder[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  className?: string
}

export function ProjectMapView({
  items,
  selectedProjectId,
  onSelect,
  className = '',
}: ProjectMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const onSelectRef = useRef(onSelect)

  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
    }).setView(PROJECT_MAP_CZECH_CENTER, PROJECT_MAP_DEFAULT_ZOOM)

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

    const mappable = items.filter((item) =>
      isValidProjectMarkerGps(item.gps_lat, item.gps_lng)
    )

    if (mappable.length === 0) {
      map.setView(PROJECT_MAP_CZECH_CENTER, PROJECT_MAP_DEFAULT_ZOOM)
      return
    }

    const bounds = L.latLngBounds([])

    mappable.forEach((item) => {
      const latlng = L.latLng(item.gps_lat!, item.gps_lng!)
      bounds.extend(latlng)

      const selected = item.project_id === selectedProjectId
      const color = PROJECT_MARKER_COLOR_HEX[item.marker_color]
      const marker = L.marker(latlng, {
        icon: createProjectPinIcon(color, item.color_label, selected),
      })

      marker.on('click', () => onSelectRef.current(item.project_id))
      marker.bindTooltip(`${item.order.name} · ${item.color_label}`, {
        direction: 'top',
        offset: L.point(0, -40),
        opacity: 0.95,
      })
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (selectedProjectId) {
      const selected = mappable.find((item) => item.project_id === selectedProjectId)
      if (selected) {
        map.flyTo([selected.gps_lat!, selected.gps_lng!], Math.max(map.getZoom(), PROJECT_MAP_SINGLE_MARKER_ZOOM), {
          duration: 0.5,
        })
        return
      }
    }

    if (bounds.isValid()) {
      if (mappable.length === 1) {
        map.setView([mappable[0].gps_lat!, mappable[0].gps_lng!], PROJECT_MAP_SINGLE_MARKER_ZOOM)
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
      }
    }
  }, [items, selectedProjectId])

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
      className={`photo-map-view project-map-view w-full rounded-2xl neon-border ${className}`}
      role="application"
      aria-label="Mapa hlavních špendlíků zakázek"
    />
  )
}
