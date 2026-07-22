function formatMapyCoord(value: number): string {
  return value.toFixed(7)
}

function buildMapyCoordinateId(lng: number, lat: number): string {
  return `${formatMapyCoord(lng)},${formatMapyCoord(lat)}`
}

/** Odkaz na Mapy.cz / Mapy.com s přesným bodem na souřadnicích. */
export function getMapyCzUrl(lat: number, lng: number, zoom = 18): string {
  const x = formatMapyCoord(lng)
  const y = formatMapyCoord(lat)
  const id = buildMapyCoordinateId(lng, lat)
  return `https://mapy.com/zakladni?x=${x}&y=${y}&z=${zoom}&source=coor&id=${encodeURIComponent(id)}`
}

/** Interaktivní mapa Mapy.cz se špendlíkem na souřadnicích (pro iframe / nové okno). */
export function getMapyCzEmbedUrl(lat: number, lng: number, zoom = 18): string {
  return getMapyCzUrl(lat, lng, zoom)
}

/** Odkaz pro otevření mapy v aplikaci Mapy.com (mobil / desktop). */
export function getMapyCzShowMapUrl(lat: number, lng: number, zoom = 18): string {
  return `https://mapy.com/fnc/v1/showmap?mapset=basic&center=${formatMapyCoord(lng)},${formatMapyCoord(lat)}&zoom=${zoom}&marker=true`
}

/** Panorama Mapy.cz (ulice / street view) na zadaných souřadnicích. */
export function getMapyCzPanoramaUrl(lat: number, lng: number, zoom = 18): string {
  const x = formatMapyCoord(lng)
  const y = formatMapyCoord(lat)
  const id = buildMapyCoordinateId(lng, lat)
  return `https://mapy.com/zakladni?pano=1&x=${x}&y=${y}&z=${zoom}&source=coor&id=${encodeURIComponent(id)}&ds=1`
}

export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function getStreetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
}

export function getOpenStreetMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.004
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`
}

export function getStreetViewEmbedUrl(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`
}

export function getOpenStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

/** Statický náhled mapy pro tisk / PDF (OpenStreetMap static map služba). */
export function getStaticMapImageUrl(lat: number, lng: number, width = 640, height = 200): string {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '16',
    size: `${width}x${height}`,
    markers: `${lat},${lng},red-pushpin`,
  })
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`
}
