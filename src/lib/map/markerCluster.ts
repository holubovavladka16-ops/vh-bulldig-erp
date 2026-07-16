import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

export function createPhotoMarkerClusterGroup(): L.MarkerClusterGroup {
  return L.markerClusterGroup({
    maxClusterRadius: 52,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 18,
  })
}

export function flyToMyLocation(map: L.Map): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolokace není podporována.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 16), {
          duration: 0.6,
        })
        resolve()
      },
      () => reject(new Error('Polohu se nepodařilo získat.')),
      { enableHighAccuracy: true, timeout: 12_000 }
    )
  })
}

export function fitMapToBounds(map: L.Map, bounds: L.LatLngBounds): void {
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 })
  }
}
